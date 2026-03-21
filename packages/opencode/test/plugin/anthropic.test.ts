import { describe, expect, test } from "bun:test"
import { parseAuthCode } from "../../src/plugin/anthropic"

describe("plugin.anthropic", () => {
  describe("parseAuthCode", () => {
    test("keeps code-only input and restores verifier state", () => {
      expect(parseAuthCode("abc123", "verifier")).toEqual({
        code: "abc123",
        state: "verifier",
      })
    })

    test("extracts code and state from callback url", () => {
      expect(parseAuthCode("https://console.anthropic.com/oauth/code/callback?code=abc123&state=oauth-state", "verifier")).toEqual({
        code: "abc123",
        state: "oauth-state",
      })
    })

    test("supports prior code#state format", () => {
      expect(parseAuthCode("abc123#oauth-state", "verifier")).toEqual({
        code: "abc123",
        state: "oauth-state",
      })
    })

    test("extracts code from raw query text", () => {
      expect(parseAuthCode("code=abc123&state=oauth-state", "verifier")).toEqual({
        code: "abc123",
        state: "oauth-state",
      })
    })
  })
})
