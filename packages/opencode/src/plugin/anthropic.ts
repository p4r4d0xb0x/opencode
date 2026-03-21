import { generatePKCE } from "@openauthjs/openauth/pkce"
import type { Hooks, PluginInput } from "@opencode-ai/plugin"

const CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e"
const REDIRECT = "https://console.anthropic.com/oauth/code/callback"

type Mode = "max" | "console"

const authUrl = async (mode: Mode) => {
  const pkce = await generatePKCE()
  const url = new URL(`https://${mode === "console" ? "console.anthropic.com" : "claude.ai"}/oauth/authorize`)
  url.searchParams.set("code", "true")
  url.searchParams.set("client_id", CLIENT_ID)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("redirect_uri", REDIRECT)
  url.searchParams.set("scope", "org:create_api_key user:profile user:inference")
  url.searchParams.set("code_challenge", pkce.challenge)
  url.searchParams.set("code_challenge_method", "S256")
  url.searchParams.set("state", pkce.verifier)
  return { url: url.toString(), verifier: pkce.verifier }
}

const search = (text: string) => {
  const query = text.startsWith("?") || text.startsWith("#") ? text.slice(1) : text
  const params = new URLSearchParams(query)
  const code = params.get("code")?.trim()
  if (!code) return
  return {
    code,
    state: params.get("state")?.trim(),
  }
}

export const parseAuthCode = (input: string, verifier: string) => {
  const text = input.trim()
  if (!text) return

  try {
    const url = new URL(text)
    const parsed = search(url.search) ?? search(url.hash)
    if (!parsed) return
    return {
      code: parsed.code,
      state: parsed.state || verifier,
    }
  } catch {}

  const parsed = search(text)
  if (parsed) {
    return {
      code: parsed.code,
      state: parsed.state || verifier,
    }
  }

  const [code, state] = text.split("#", 2).map((part) => part?.trim())
  if (!code) return
  return {
    code,
    state: state || verifier,
  }
}

const exchange = async (code: string, verifier: string) => {
  const parsed = parseAuthCode(code, verifier)
  if (!parsed) return { type: "failed" as const }
  const res = await fetch("https://console.anthropic.com/v1/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: parsed.code,
      state: parsed.state,
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT,
      code_verifier: verifier,
    }),
  })
  if (!res.ok) return { type: "failed" as const }
  const json = (await res.json()) as {
    refresh_token: string
    access_token: string
    expires_in: number
  }
  return {
    type: "success" as const,
    refresh: json.refresh_token,
    access: json.access_token,
    expires: Date.now() + json.expires_in * 1000,
  }
}

const headers = (input: RequestInfo | URL, init?: RequestInit) => {
  const out = new Headers()
  if (input instanceof Request) {
    input.headers.forEach((v, k) => out.set(k, v))
  }
  if (init?.headers instanceof Headers) {
    init.headers.forEach((v, k) => out.set(k, v))
  }
  if (Array.isArray(init?.headers)) {
    for (const [k, v] of init.headers) {
      if (typeof v !== "undefined") out.set(k, String(v))
    }
  }
  if (init?.headers && !(init.headers instanceof Headers) && !Array.isArray(init.headers)) {
    for (const [k, v] of Object.entries(init.headers)) {
      if (typeof v !== "undefined") out.set(k, String(v))
    }
  }
  return out
}

export async function AnthropicAuthPlugin({ client }: PluginInput): Promise<Hooks> {
  return {
    "experimental.chat.system.transform": async (input, output) => {
      const text = "You are Claude Code, Anthropic's official CLI for Claude."
      if (input.model?.providerID !== "anthropic") return
      output.system.unshift(text)
      if (!output.system[1]) return
      output.system[1] = text + "\n\n" + output.system[1]
    },
    auth: {
      provider: "anthropic",
      async loader(getAuth, provider) {
        const auth = await getAuth()
        if (auth.type === "oauth") {
          for (const model of Object.values(provider.models)) {
            model.cost = {
              input: 0,
              output: 0,
              cache: { read: 0, write: 0 },
            }
          }
          return {
            apiKey: "",
            async fetch(input: RequestInfo | URL, init?: RequestInit) {
              const auth = await getAuth()
              if (auth.type !== "oauth") return fetch(input, init)
              if (!auth.access || auth.expires < Date.now()) {
                const res = await fetch("https://console.anthropic.com/v1/oauth/token", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    grant_type: "refresh_token",
                    refresh_token: auth.refresh,
                    client_id: CLIENT_ID,
                  }),
                })
                if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`)
                const json = (await res.json()) as { refresh_token: string; access_token: string; expires_in: number }
                await client.auth.set({
                  path: { id: "anthropic" },
                  body: {
                    type: "oauth",
                    refresh: json.refresh_token,
                    access: json.access_token,
                    expires: Date.now() + json.expires_in * 1000,
                  },
                })
                auth.access = json.access_token
              }

              const req = headers(input, init)
              const list = (req.get("anthropic-beta") || "")
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean)
              const beta = [...new Set(["oauth-2025-04-20", "interleaved-thinking-2025-05-14", ...list])].join(",")

              req.set("authorization", `Bearer ${auth.access}`)
              req.set("anthropic-beta", beta)
              req.set("user-agent", "claude-cli/2.1.2 (external, cli)")
              req.delete("x-api-key")

              let body = init?.body
              if (typeof body === "string") {
                try {
                  const json = JSON.parse(body) as {
                    system?: Array<{ type?: string; text?: string }>
                    tools?: Array<{ name?: string }>
                    messages?: Array<{ content?: Array<{ type?: string; name?: string }> }>
                  }
                  if (Array.isArray(json.system)) {
                    json.system = json.system.map((item) => {
                      if (item.type !== "text" || !item.text) return item
                      return {
                        ...item,
                        text: item.text.replace(/OpenCode/g, "Claude Code").replace(/opencode/gi, "Claude"),
                      }
                    })
                  }
                  if (Array.isArray(json.tools)) {
                    json.tools = json.tools.map((tool) => ({
                      ...tool,
                      name: tool.name ? `mcp_${tool.name}` : tool.name,
                    }))
                  }
                  if (Array.isArray(json.messages)) {
                    json.messages = json.messages.map((msg) => {
                      if (!Array.isArray(msg.content)) return msg
                      return {
                        ...msg,
                        content: msg.content.map((part) => {
                          if (part.type !== "tool_use" || !part.name) return part
                          return { ...part, name: `mcp_${part.name}` }
                        }),
                      }
                    })
                  }
                  body = JSON.stringify(json)
                } catch {}
              }

              let next = input
              let url: URL | undefined
              try {
                if (typeof input === "string" || input instanceof URL) url = new URL(input.toString())
                if (input instanceof Request) url = new URL(input.url)
              } catch {}
              if (url?.pathname === "/v1/messages" && !url.searchParams.has("beta")) {
                url.searchParams.set("beta", "true")
                next = input instanceof Request ? new Request(url.toString(), input) : url
              }

              const res = await fetch(next, {
                ...init,
                body,
                headers: req,
              })
              if (!res.body) return res

              const reader = res.body.getReader()
              const dec = new TextDecoder()
              const enc = new TextEncoder()
              const stream = new ReadableStream({
                async pull(ctrl) {
                  const data = await reader.read()
                  if (data.done) {
                    ctrl.close()
                    return
                  }
                  const text = dec.decode(data.value, { stream: true }).replace(/"name"\s*:\s*"mcp_([^"]+)"/g, '"name": "$1"')
                  ctrl.enqueue(enc.encode(text))
                },
              })

              return new Response(stream, {
                status: res.status,
                statusText: res.statusText,
                headers: res.headers,
              })
            },
          }
        }
        return {}
      },
      methods: [
        {
          label: "Claude Pro/Max",
          type: "oauth",
          authorize: async () => {
            const auth = await authUrl("max")
            return {
              url: auth.url,
              instructions: "Paste the authorization code here: ",
              method: "code" as const,
              callback: async (code: string) => exchange(code, auth.verifier),
            }
          },
        },
        {
          label: "Create an API Key",
          type: "oauth",
          authorize: async () => {
            const auth = await authUrl("console")
            return {
              url: auth.url,
              instructions: "Paste the authorization code here: ",
              method: "code" as const,
              callback: async (code: string) => {
                const result = await exchange(code, auth.verifier)
                if (result.type === "failed") return result
                const res = await fetch("https://api.anthropic.com/api/oauth/claude_cli/create_api_key", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    authorization: `Bearer ${result.access}`,
                  },
                })
                const json = (await res.json()) as { raw_key: string }
                return { type: "success" as const, key: json.raw_key }
              },
            }
          },
        },
        {
          label: "Manually enter API Key",
          type: "api",
        },
      ],
    },
  }
}
