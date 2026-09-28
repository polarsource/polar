import { connect } from 'node:net'
import {
  Console,
  Data,
  Duration,
  Effect,
  Exit,
  Option,
  Schema,
  Stdio,
  Stream,
} from 'effect'
import { Argument, Command } from 'effect/unstable/cli'
import { Sse } from 'effect/unstable/encoding'
import {
  FetchHttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from 'effect/unstable/http'
import { apiUrl, authenticatedClient } from '@/services/api'
import { Organizations } from '@/services/organizations'
import { org } from '@/commands/flags'
import { loginCommand, type PolarEnvironment } from '@/schemas/Auth'
import {
  ListenAck,
  ListenReconnect,
  ListenWebhookEvent,
} from '@/schemas/Events'
import * as ui from '@/utils/ui'

export class ListenError extends Data.TaggedError('ListenError')<{
  message: string
  code: number
  cause?: unknown
}> {}

const EVENT_TYPE_WIDTH = 28

const printError = (line: string) =>
  Effect.sync(() => {
    process.stderr.write(`${line}\n`)
  })

const refusedCodes = new Set(['ConnectionRefused', 'ECONNREFUSED'])

const describeForwardFailure = (error: unknown) => {
  const cause =
    error instanceof Error && error.cause instanceof Error ? error.cause : error
  const code =
    typeof cause === 'object' && cause !== null && 'code' in cause
      ? String(cause.code)
      : undefined
  const message = cause instanceof Error ? cause.message : String(cause)
  if ((code && refusedCodes.has(code)) || /ECONNREFUSED/i.test(message)) {
    return 'connection refused, is your server running?'
  }
  return message
}

const eventLine = (eventType: string, outcome: string, startedAt: number) =>
  `  ${ui.timestamp()}  ${ui.cyan(eventType.padEnd(EVENT_TYPE_WIDTH))}  ${outcome}  ${ui.duration(performance.now() - startedAt)}`

const decodeFailure = (key: string | undefined) =>
  ui.failure(
    'Received an event the CLI could not decode',
    `Event key: ${key ?? 'unknown'}. Run ${ui.command('polar update')} in case the format changed.`,
  )

const banner = (organizationName: string, secret: string, forwardUrl: string) =>
  [
    ui.blank,
    `  ${ui.green('●')} ${ui.bold('Connected')}  ${ui.bold(organizationName)}`,
    ui.keyValue([
      ['Forwarding', forwardUrl],
      [
        'Secret',
        `${secret}  ${ui.dim('use this to verify signatures locally')}`,
      ],
    ]),
    ui.blank,
    ui.step(`Waiting for events... press ${ui.bold('Ctrl+C')} to stop`),
    ui.blank,
  ].join('\n')

export interface StartListeningOptions {
  listenUrl: string
  forwardUrl: string
  organizationName: string
  environment: PolarEnvironment
  forward?: (
    input: Parameters<typeof fetch>[0],
    init?: RequestInit,
  ) => Promise<Response>
}

export const startListening = ({
  listenUrl,
  forwardUrl,
  organizationName,
  environment,
  forward = fetch,
}: StartListeningOptions) =>
  Effect.gen(function* () {
    const client = yield* authenticatedClient(environment)
    let bannerShown = false
    let retryDelay = Duration.millis(3000)
    let lastEventId: string | undefined
    const connection = Effect.scoped(
      Effect.gen(function* () {
        let request = HttpClientRequest.get(listenUrl).pipe(
          HttpClientRequest.setHeader('Accept', 'text/event-stream'),
        )
        if (lastEventId)
          request = HttpClientRequest.setHeader(
            request,
            'Last-Event-ID',
            lastEventId,
          )
        const response = yield* client.execute(request)
        if (response.status !== 200) {
          return yield* new ListenError({
            code: response.status,
            message: `Event stream error (${response.status})`,
          })
        }
        if (
          !response.headers['content-type']
            ?.toLowerCase()
            .startsWith('text/event-stream')
        ) {
          return yield* new ListenError({
            code: 200,
            message: 'Expected a text/event-stream response.',
          })
        }
        let reconnect = false
        yield* HttpClientResponse.stream(Effect.succeed(response)).pipe(
          Stream.decodeText(),
          Stream.pipeThroughChannel(Sse.decode()),
          Stream.mapEffect((event) =>
            Effect.gen(function* () {
              if (event.id !== undefined) lastEventId = event.id
              if (event.event !== 'message') return
              const decoded = Schema.decodeUnknownExit(
                Schema.fromJsonString(Schema.Unknown),
              )(event.data)
              if (Exit.isFailure(decoded)) {
                yield* printError(decodeFailure(undefined))
                return
              }
              const json = decoded.value
              const ack = Schema.decodeUnknownExit(ListenAck)(json)
              if (Exit.isSuccess(ack)) {
                if (bannerShown) return
                bannerShown = true
                yield* Console.log(
                  banner(organizationName, ack.value.secret, forwardUrl),
                )
                return
              }
              if (
                Exit.isSuccess(Schema.decodeUnknownExit(ListenReconnect)(json))
              ) {
                reconnect = true
                return
              }
              const webhook = Schema.decodeUnknownExit(ListenWebhookEvent)(json)
              if (Exit.isFailure(webhook)) {
                const key =
                  typeof json === 'object' && json !== null && 'key' in json
                    ? String(json.key)
                    : undefined
                yield* printError(decodeFailure(key))
                return
              }
              const rawPayload = webhook.value.payload.payload
              const payload = Schema.decodeUnknownExit(
                Schema.fromJsonString(
                  Schema.Struct({ type: Schema.optional(Schema.String) }),
                ),
              )(rawPayload)
              const eventType = Exit.isSuccess(payload)
                ? (payload.value.type ?? 'event')
                : 'event'
              const startedAt = performance.now()
              yield* Effect.tryPromise((signal) =>
                forward(forwardUrl, {
                  method: 'POST',
                  headers: webhook.value.headers,
                  body: rawPayload,
                  signal,
                }),
              ).pipe(
                Effect.flatMap((result) =>
                  Effect.tryPromise(
                    () => result.body?.cancel() ?? Promise.resolve(),
                  ).pipe(
                    Effect.andThen(
                      Console.log(
                        eventLine(
                          eventType,
                          ui.statusCode(result.status, result.statusText),
                          startedAt,
                        ),
                      ),
                    ),
                  ),
                ),
                Effect.catch((error) =>
                  printError(
                    eventLine(
                      eventType,
                      ui.red(`failed  ${describeForwardFailure(error)}`),
                      startedAt,
                    ),
                  ),
                ),
              )
            }),
          ),
          Stream.takeUntil(() => reconnect),
          Stream.runDrain,
        )
        return reconnect
      }),
    )
    return yield* connection.pipe(
      Effect.catchTag('Retry', (retry) => {
        retryDelay = retry.duration
        if (retry.lastEventId !== undefined) lastEventId = retry.lastEventId
        return Effect.succeed(false)
      }),
      Effect.catchTag('HttpClientError', (error) =>
        error.reason._tag === 'TransportError' ||
        error.reason._tag === 'DecodeError'
          ? Effect.succeed(false)
          : Effect.fail(
              new ListenError({
                code: 0,
                message: error.message,
                cause: error,
              }),
            ),
      ),
      Effect.flatMap((reconnect) =>
        reconnect ? Effect.void : Effect.sleep(retryDelay),
      ),
      Effect.forever,
    )
  }).pipe(
    Effect.catchTag('AuthError', (error) =>
      Effect.fail(
        new ListenError({
          code: 0,
          message:
            'Unable to authenticate the stream. Check your connection, keyring, and token; try polar auth whoami for details.',
          cause: error,
        }),
      ),
    ),
    Effect.catchTag('SseError', (error) =>
      Effect.fail(
        new ListenError({ code: 0, message: error.message, cause: error }),
      ),
    ),
  )

export const forwardTarget = (input: string): URL | undefined => {
  const value = input.trim()
  const expanded = /^\d+(\/|$)/.test(value)
    ? `http://localhost:${value}`
    : value.startsWith(':')
      ? `http://localhost${value}`
      : /^[a-z][a-z\d+.-]*:\/\//i.test(value)
        ? value
        : `http://${value}`
  try {
    const url = new URL(expanded)
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url
      : undefined
  } catch {
    return undefined
  }
}

export const connectionRefused = (url: URL) =>
  Effect.callback<boolean>((resume) => {
    let settled = false
    const socket = connect({
      host: url.hostname.replace(/^\[|\]$/g, ''),
      port: Number(url.port) || (url.protocol === 'https:' ? 443 : 80),
    })
    const settle = (refused: boolean) => {
      socket.destroy()
      if (settled) return
      settled = true
      resume(Effect.succeed(refused))
    }
    socket.setTimeout(1000)
    socket.once('connect', () => settle(false))
    socket.once('timeout', () => settle(false))
    socket.once('error', (error: NodeJS.ErrnoException) =>
      settle(error.code === 'ECONNREFUSED'),
    )
    return Effect.sync(() => socket.destroy())
  })

export const withTerminalTitle = <A, E, R>(
  title: string,
  effect: Effect.Effect<A, E, R>,
) =>
  Effect.gen(function* () {
    const stdio = yield* Stdio.Stdio
    if (!(yield* stdio.stdoutIsTerminal)) return yield* effect
    return yield* Effect.acquireUseRelease(
      Effect.sync(() => process.stdout.write(ui.pushTitle(title))),
      () => effect,
      () => Effect.sync(() => process.stdout.write(ui.popTitle)),
    )
  })

const url = Argument.String('url').pipe(
  Argument.withDescription(
    'Where to forward webhook events: a port like 3000, or a URL like http://localhost:3000/api/webhooks',
  ),
)

export const listen = Command.make('listen', { url, org }, ({ url, org }) =>
  Effect.gen(function* () {
    const target = forwardTarget(url)
    if (!target) {
      return yield* new ListenError({
        code: 0,
        message: `"${url}" is not a port or an http(s) URL. Try polar listen 3000 or polar listen http://localhost:3000/api/webhooks.`,
      })
    }
    const organizations = yield* Organizations
    const organization = yield* organizations.resolve(
      Option.getOrUndefined(org),
    )
    const { environment } = organization
    const listenUrl = yield* apiUrl(
      environment,
      `/cli/listen/${organization.id}`,
    )
    if (yield* connectionRefused(target)) {
      yield* Console.log(ui.blank)
      yield* Console.log(ui.warning(`Nothing is running on ${target.host} yet`))
      yield* Console.log(
        ui.step('Start your server, events that arrive before then will fail'),
      )
    }
    return yield* withTerminalTitle(
      `polar listen · ${organization.name}`,
      startListening({
        listenUrl,
        forwardUrl: target.href,
        organizationName: organization.name,
        environment,
      }).pipe(
        Effect.provide(FetchHttpClient.layer),
        Effect.mapError((error) =>
          error.code === 401
            ? new ListenError({
                code: 401,
                message: `Authentication rejected for ${environment}. Check POLAR_ACCESS_TOKEN or run ${loginCommand(environment)} --new-session.`,
              })
            : error,
        ),
      ),
    )
  }),
).pipe(
  Command.withDescription(
    'Forward webhook events for an organization to a local URL',
  ),
  Command.withExamples([
    {
      command: 'polar listen 3000',
      description: 'Forward events to http://localhost:3000',
    },
    {
      command: 'polar listen 3000/api/webhooks',
      description: 'Forward events to a route on your local server',
    },
    {
      command: 'polar listen http://localhost:3000/api/webhooks --org <id>',
      description: 'Forward events for a specific organization',
    },
  ]),
)
