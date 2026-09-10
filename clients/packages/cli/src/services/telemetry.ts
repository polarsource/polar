import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { Context, Effect, FileSystem, Layer } from 'effect'
import { HttpClient, HttpClientRequest } from 'effect/unstable/http'
import {
  type CommandOutcome,
  type Env,
  detectAgent,
  enabled,
  field,
  isCI,
  isCompiledBinary,
  isOptedOut,
} from '@/services/telemetry-event'
import { VERSION } from '@/version'

export * from '@/services/telemetry-event'

export const ENDPOINT_VARIABLE = 'POLAR_CLI_TELEMETRY_URL'
export const PROJECT_KEY_VARIABLE = 'POLAR_CLI_POSTHOG_KEY'
export const FORCE_VARIABLE = 'POLAR_CLI_TELEMETRY_FORCE'
export const SENDER_COMMAND = '__telemetry'
const ENDPOINT = 'https://us.i.posthog.com/capture/'
const PROJECT_KEY = 'phc_H2ajVAY4cy0uQpcgN5fzpv8JC3yP8VZOjx2EXiFBbgz'
const EVENT = 'cli_command'
const SEND_TIMEOUT = '5 seconds'

declare const POLAR_CLI_BUILD: string | undefined

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
