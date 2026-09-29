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
import { Deliveries, type Delivery } from '@/services/deliveries'
import { Organizations } from '@/services/organizations'
import { org } from '@/commands/flags'
import { loginCommand, type PolarEnvironment } from '@/schemas/Auth'
import {
  ListenAck,
  ListenReconnect,
  ListenWebhookEvent,
} from '@/schemas/Events'
import * as ui from '@/utils/ui'
import { redactUrl } from '@/utils/url'

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

const refused = 'connection refused, is your server running?'

const failureHints = new Map([
  ['ConnectionRefused', refused],
  ['ECONNREFUSED', refused],
  ['ENOTFOUND', 'host not found, check the forward URL'],
])

const describeForwardFailure = (error: unknown) => {
  const cause =
    error instanceof Error && error.cause instanceof Error ? error.cause : error
  const code =
    typeof cause === 'object' && cause !== null && 'code' in cause
      ? String(cause.code)
      : ''
  const message = cause instanceof Error ? cause.message : String(cause)
  return (
    failureHints.get(code) ??
    (/ECONNREFUSED/i.test(message) ? refused : message)
  )
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
    const deliveries = yield* Deliveries
    const shownUrl = redactUrl(forwardUrl)
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
                  banner(organizationName, ack.value.secret, shownUrl),
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
              const record = (
                outcome: Pick<Delivery, 'status' | 'statusText' | 'failure'>,
              ) =>
                webhook.value.headers['x-polar-triggered'] === 'true'
                  ? deliveries.record(webhook.value.payload.webhook_event_id, {
                      forwardUrl: shownUrl,
                      durationMs: performance.now() - startedAt,
                      ...outcome,
                    })
                  : Effect.void
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
                    Effect.andThen(
                      record({
                        status: result.status,
                        statusText: result.statusText,
                      }),
                    ),
                  ),
                ),
                Effect.catch((error) => {
                  const failure = describeForwardFailure(error)
                  return printError(
                    eventLine(
                      eventType,
                      ui.red(`failed  ${failure}`),
                      startedAt,
                    ),
                  ).pipe(Effect.andThen(record({ failure })))
                }),
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

export type TargetStatus = 'answering' | 'refused' | 'unknownHost' | 'unknown'

const statusOfError = (code: string | undefined): TargetStatus =>
  code === 'ECONNREFUSED'
    ? 'refused'
    : code === 'ENOTFOUND'
      ? 'unknownHost'
      : 'unknown'

export const probeTarget = (url: URL) =>
  Effect.callback<TargetStatus>((resume) => {
    let settled = false
    const socket = connect({
      host: url.hostname.replace(/^\[|\]$/g, ''),
      port: Number(url.port) || (url.protocol === 'https:' ? 443 : 80),
    })
    const settle = (status: TargetStatus) => {
      socket.destroy()
      if (settled) return
      settled = true
      resume(Effect.succeed(status))
    }
    socket.setTimeout(1000)
    socket.once('connect', () => settle('answering'))
    socket.once('timeout', () => settle('unknown'))
    socket.once('error', (error: NodeJS.ErrnoException) =>
      settle(statusOfError(error.code)),
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
    const status = yield* probeTarget(target)
    if (status === 'unknownHost') {
      return yield* new ListenError({
        code: 0,
        message: `Can't find a host named "${target.hostname}". To forward to a server on this machine, pass its port, e.g. polar listen 3000.`,
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
    if (status === 'refused') {
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
