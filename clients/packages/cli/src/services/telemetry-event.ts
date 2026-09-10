import { Cause, Exit, Runtime } from 'effect'

export const OPT_OUT_VARIABLE = 'POLAR_CLI_TELEMETRY_OPTOUT'

export type Env = Record<string, string | undefined>

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

export const enabled = (value: string | undefined) =>
  value !== undefined && ['1', 'true', 'yes'].includes(value.toLowerCase())

export const isOptedOut = (env: Env) =>
  enabled(env[OPT_OUT_VARIABLE]) || enabled(env['DO_NOT_TRACK'])

export const isCI = (env: Env) =>
  enabled(env['CI']) || env['GITHUB_ACTIONS'] !== undefined

export const isCompiledBinary = (main = Bun.main) =>
  main.startsWith('/$bunfs/') || /^[A-Za-z]:\\~BUN\\/.test(main)

export const detectAgent = (env: Env) => {
  const names = Object.keys(env).filter((name) => env[name])
  const known = agents.find(([, pattern]) =>
    names.some((name) => pattern.test(name)),
  )?.[0]
  return known ?? env['AI_AGENT']?.toLowerCase() ?? undefined
}

interface CommandTree {
  readonly name: string
  readonly subcommands: ReadonlyArray<{
    readonly commands: ReadonlyArray<CommandTree>
  }>
}

export const commandPath = (
  command: CommandTree,
  args: ReadonlyArray<string>,
) => {
  const path = [command.name]
  let current = command
  for (const token of args) {
    const candidates = current.subcommands.flatMap((group) => group.commands)
    if (candidates.length === 0) break
    const next = candidates.find((child) => child.name === token)
    if (!next) continue
    path.push(next.name)
    current = next
  }
  return path
}

export const flagNames = (args: ReadonlyArray<string>) => [
  ...new Set(
    args
      .filter((arg) => arg.startsWith('-') && arg !== '-' && arg !== '--')
      .map((arg) => arg.replace(/^-+/, '').split('=')[0]!),
  ),
]

export interface Failure {
  error: string
  errorMessage?: string
  errorCode?: number
}

export interface CommandOutcome extends Partial<Failure> {
  command: string[]
  flags: string[]
  outcome: 'success' | 'failure' | 'interrupted'
  durationMs: number
}

const redactions: ReadonlyArray<RegExp> = [
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  /\bBearer\s+\S+/gi,
  /\b(?:polar_|sk_|pk_|rk_|whsec_|ghp_|gho_|ghu_|ghs_|ghr_|github_pat_|glpat-|xox[baprs]-|AIza|ya29\.)[A-Za-z0-9_.-]+/g,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
  /\b[a-z][a-z0-9+.-]*:\/\/\S+/gi,
  /(?:\/Users|\/home|\/root|\/tmp|\/var|\/private|[A-Za-z]:\\Users)(?:[\\/]\S*|\b)/g,
  /\S+@\S+\.\S+/g,
  /\b\d{1,3}(?:\.\d{1,3}){3}\b/g,
  /\b[A-Za-z0-9_-]{32,}\b/g,
]

export const redact = (text: string) =>
  redactions
    .reduce(
      (result, pattern) => result.replace(pattern, '<redacted>'),
      text.slice(0, 1000),
    )
    .slice(0, 200)

export const field = (value: unknown, key: string): unknown =>
  typeof value === 'object' && value !== null && key in value
    ? (value as Record<string, unknown>)[key]
    : undefined

export const describeFailure = (error: unknown): Failure => {
  const tag = field(error, '_tag')
  const reason = field(error, 'reason')
  const reasonTag = field(reason, '_tag')
  const name =
    tag !== undefined
      ? `${String(tag)}${reasonTag !== undefined ? `:${String(reasonTag)}` : ''}`
      : error instanceof Error
        ? error.name
        : 'Unknown'
  const message = field(error, 'message')
  const code =
    field(error, 'code') ?? field(field(reason, 'response'), 'status')
  return {
    error: name,
    ...(typeof message === 'string' && message
      ? { errorMessage: redact(message) }
      : {}),
    ...(typeof code === 'number' ? { errorCode: code } : {}),
  }
}

export const outcomeOf = (
  exit: Exit.Exit<unknown, unknown>,
): Pick<CommandOutcome, 'outcome' | 'error' | 'errorMessage' | 'errorCode'> => {
  if (Exit.isSuccess(exit)) return { outcome: 'success' }
  if (Cause.hasInterruptsOnly(exit.cause)) return { outcome: 'interrupted' }
  const error = Cause.squash(exit.cause)
  if (Runtime.getErrorExitCode(error) === 0) return { outcome: 'success' }
  return { outcome: 'failure', ...describeFailure(error) }
}
