import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  Cause,
  Context,
  Effect,
  Exit,
  FileSystem,
  Layer,
  Runtime,
} from 'effect'
import { HttpClient, HttpClientRequest } from 'effect/unstable/http'
import { VERSION } from '@/version'

export const OPT_OUT_VARIABLE = 'POLAR_CLI_TELEMETRY_OPTOUT'
export const ENDPOINT_VARIABLE = 'POLAR_CLI_TELEMETRY_URL'
export const PROJECT_KEY_VARIABLE = 'POLAR_CLI_POSTHOG_KEY'
export const FORCE_VARIABLE = 'POLAR_CLI_TELEMETRY_FORCE'
export const SENDER_COMMAND = '__telemetry'
const ENDPOINT = 'https://us.i.posthog.com/capture/'
const PROJECT_KEY = 'phc_H2ajVAY4cy0uQpcgN5fzpv8JC3yP8VZOjx2EXiFBbgz'
const EVENT = 'cli_command'
const SEND_TIMEOUT = '5 seconds'

declare const POLAR_CLI_BUILD: string | undefined

type Env = Record<string, string | undefined>

export const Environment = Context.Reference<Env>(
  'polar/Telemetry/Environment',
  { defaultValue: () => process.env },
)

export type BuildKind = 'release' | 'development'

export const Build = Context.Reference<BuildKind>('polar/Telemetry/Build', {
  defaultValue: () =>
    typeof POLAR_CLI_BUILD !== 'undefined' && POLAR_CLI_BUILD === 'release'
      ? 'release'
      : 'development',
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

const enabled = (value: string | undefined) =>
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

const field = (value: unknown, key: string): unknown =>
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

export interface TelemetryEvent {
  api_key: string
  event: string
  distinct_id: string
  timestamp: string
  properties: Record<string, unknown>
}

export class Sender extends Context.Service<
  Sender,
  { dispatch: (event: TelemetryEvent) => Effect.Effect<void> }
>()('polar/Telemetry/Sender') {}

export class Telemetry extends Context.Service<
  Telemetry,
  { record: (outcome: CommandOutcome) => Effect.Effect<void> }
>()('polar/Telemetry') {}

const stateFile = join(homedir(), '.polar', 'telemetry.json')

const installId = (fs: FileSystem.FileSystem) =>
  Effect.gen(function* () {
    const stored = yield* fs.readFileString(stateFile).pipe(
      Effect.flatMap((raw) =>
        Effect.try(() => JSON.parse(raw) as { installId?: unknown }),
      ),
      Effect.orElseSucceed(() => ({}) as { installId?: unknown }),
    )
    const existing = field(stored, 'installId')
    if (typeof existing === 'string') return existing
    const id = randomUUID()
    yield* fs
      .makeDirectory(dirname(stateFile), { recursive: true })
      .pipe(
        Effect.andThen(
          fs.writeFileString(
            stateFile,
            `${JSON.stringify({ installId: id }, null, 2)}\n`,
          ),
        ),
        Effect.ignore,
      )
    return id
  })

export const layer = Layer.effect(
  Telemetry,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const sender = yield* Sender
    const env = yield* Environment
    const build = yield* Build
    const projectKey = env[PROJECT_KEY_VARIABLE] || PROJECT_KEY
    const active =
      !isOptedOut(env) &&
      (build === 'release' ||
        !!env[ENDPOINT_VARIABLE] ||
        enabled(env[FORCE_VARIABLE]))
    return Telemetry.of({
      record: (result) =>
        Effect.gen(function* () {
          if (!active) return
          const id = yield* installId(fs)
          yield* sender.dispatch({
            api_key: projectKey,
            event: EVENT,
            distinct_id: `cli:${id}`,
            timestamp: new Date().toISOString(),
            properties: {
              command: result.command.join(' '),
              flags: result.flags,
              outcome: result.outcome,
              error: result.error ?? null,
              error_message: result.errorMessage ?? null,
              error_code: result.errorCode ?? null,
              duration_ms: Math.round(result.durationMs),
              cli_version: VERSION.replace(/^v/, ''),
              os: process.platform,
              arch: process.arch,
              runtime: `bun ${Bun.version}`,
              agent: detectAgent(env) ?? null,
              ci: isCI(env),
              build,
              $process_person_profile: false,
            },
          })
        }).pipe(Effect.ignoreCause),
    })
  }),
)

export const send = (event: TelemetryEvent) =>
  Effect.gen(function* () {
    const env = yield* Environment
    const client = yield* HttpClient.HttpClient
    const request = yield* HttpClientRequest.post(
      env[ENDPOINT_VARIABLE] || ENDPOINT,
    ).pipe(HttpClientRequest.bodyJson(event))
    yield* client.execute(request)
  }).pipe(Effect.scoped, Effect.timeout(SEND_TIMEOUT), Effect.ignoreCause)

export const httpSender = Layer.effect(
  Sender,
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient
    const env = yield* Environment
    return Sender.of({
      dispatch: (event) =>
        send(event).pipe(
          Effect.provideService(HttpClient.HttpClient, client),
          Effect.provideService(Environment, env),
        ),
    })
  }),
)

export const detachedSender = Layer.succeed(
  Sender,
  Sender.of({
    dispatch: (event) =>
      Effect.try(() => {
        const command = isCompiledBinary()
          ? [process.execPath, SENDER_COMMAND]
          : [process.execPath, Bun.main, SENDER_COMMAND]
        const child = Bun.spawn(command, {
          stdin: 'pipe',
          stdout: 'ignore',
          stderr: 'ignore',
        })
        child.stdin.write(JSON.stringify(event))
        child.stdin.end()
        child.unref()
      }).pipe(Effect.ignoreCause),
  }),
)

export const sendFromStdin = Effect.gen(function* () {
  const raw = yield* Effect.tryPromise(() =>
    new Response(Bun.stdin.stream()).text(),
  )
  const event = yield* Effect.try(() => JSON.parse(raw) as TelemetryEvent)
  yield* send(event)
}).pipe(Effect.ignoreCause)
