import type { Hooks, PluginInput } from "@opencode-ai/plugin"

const STRATEGY = [
  "Shell environment is non-interactive (no TTY).",
  "Always use non-interactive flags such as -y, --yes, --no-edit, --force, --non-interactive.",
  "Never run interactive commands such as vim, nano, less, more, man, git add -p, git rebase -i.",
  "Use non-interactive command forms and explicit arguments for package managers and git commands.",
  "Prefer native Read/Write/Edit tools over shell text editing.",
].join("\n")

export async function ShellStrategyPlugin(_input: PluginInput): Promise<Hooks> {
  return {
    "experimental.chat.system.transform": async (_input, output) => {
      output.system.unshift(STRATEGY)
    },
  }
}
