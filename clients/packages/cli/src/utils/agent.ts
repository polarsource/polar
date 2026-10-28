import { Context } from 'effect'

export type Env = Record<string, string | undefined>

export const Environment = Context.Reference<Env>('polar/Agent/Environment', {
  defaultValue: () => process.env,
})

const agents: ReadonlyArray<readonly [string, RegExp]> = [
  ['claude-code', /^CLAUDECODE$|^CLAUDE_CODE_/],
  ['cursor', /^CURSOR_/],
  ['codex', /^CODEX_/],
  ['opencode', /^OPENCODE_/],
  ['pi', /^PI_CODING_AGENT$/],
  ['gemini-cli', /^GEMINI_CLI$/],
  ['copilot', /^(GITHUB_)?COPILOT_/],
  ['aider', /^AIDER_/],
  ['windsurf', /^WINDSURF_/],
]

export const detectAgent = (env: Env) => {
  const names = Object.keys(env).filter((name) => env[name])
  const known = agents.find(([, pattern]) =>
    names.some((name) => pattern.test(name)),
  )?.[0]
  return known ?? env['AI_AGENT']?.toLowerCase() ?? undefined
}
