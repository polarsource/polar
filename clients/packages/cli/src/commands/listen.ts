import {
  Console,
  Data,
  Duration,
  Effect,
  Exit,
  Option,
  Schema,
  Scope,
  Stream,
} from 'effect'
import { Argument, Command } from 'effect/unstable/cli'
import { Sse } from 'effect/unstable/encoding'
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from 'effect/unstable/http'
import { Auth } from '../services/auth'
import { Organizations } from '../services/organizations'
import { environmentOf, org, production } from './flags'
import { type PolarEnvironment } from '../schemas/Auth'
import {
  ListenAck,
  ListenReconnect,
  ListenWebhookEvent,
} from '../schemas/Events'

export const LISTEN_BASE_URLS = {
  production: 'https://api.polar.sh/v1/cli/listen',
  sandbox: 'https://sandbox-api.polar.sh/v1/cli/listen',
} as const

export class ListenError extends Data.TaggedError('ListenError')<{
  message: string
  code: number
  cause?: unknown
}> {}

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

export const authenticatedStreamClient = (environment: PolarEnvironment) =>
  Effect.gen(function* () {
    const auth = yield* Auth
    const client = HttpClient.withScope(yield* HttpClient.HttpClient)
    let retried = false
    return HttpClient.transform(client, (_response, request) =>
      Effect.gen(function* () {
        const credential = yield* auth.resolve(environment)
        const requestScope = yield* Scope.fork(yield* Effect.scope)
        const response = yield* client
          .execute(
            HttpClientRequest.bearerToken(request, credential.accessToken),
          )
          .pipe(Effect.provideService(Scope.Scope, requestScope))
        if (
          response.status !== 401 ||
          retried ||
          credential.source === 'override'
        )
          return response
        retried = true
        yield* Scope.close(requestScope, Exit.void)
        const refreshed = yield* auth.resolve(
          environment,
          credential.accessToken,
        )
        return yield* client.execute(
          HttpClientRequest.bearerToken(request, refreshed.accessToken),
        )
      }),
    )
  })

export const startListening = ({
  listenUrl,
  forwardUrl,
  organizationName,
  environment,
  forward = fetch,
}: StartListeningOptions) =>
  Effect.gen(function* () {
    const client = yield* authenticatedStreamClient(environment)
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
                yield* Console.error('>> Failed to decode event')
                return
              }
              const json = decoded.value
              const ack = Schema.decodeUnknownExit(ListenAck)(json)
              if (Exit.isSuccess(ack)) {
                if (bannerShown) return
                bannerShown = true
                const dim = '\x1b[2m'
                const bold = '\x1b[1m'
                const cyan = '\x1b[36m'
                const reset = '\x1b[0m'
                yield* Console.log(
                  `\n  ${bold}${cyan}Connected${reset}  ${bold}${organizationName}${reset}\n  ${dim}Secret${reset}     ${ack.value.secret}\n  ${dim}Forwarding${reset} ${forwardUrl}\n\n  ${dim}Waiting for events...${reset}\n`,
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
                yield* Console.error('>> Failed to decode event')
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
                        `>> '\x1b[36m${eventType}\x1b[0m' >> ${result.status} ${result.statusText}`,
                      ),
                    ),
                  ),
                ),
                Effect.catch((error) =>
                  Console.error(`>> Failed to forward event: ${error}`),
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

const url = Argument.string('url')

export const listen = Command.make(
  'listen',
  { url, production, org },
  ({ url, production, org }) =>
    Effect.gen(function* () {
      const environment = environmentOf(production)
      const organizations = yield* Organizations
      const organization = yield* organizations.resolve(
        environment,
        Option.getOrUndefined(org),
      )
      return yield* startListening({
        listenUrl: `${LISTEN_BASE_URLS[environment]}/${organization.id}`,
        forwardUrl: url,
        organizationName: organization.name,
        environment,
      }).pipe(
        Effect.provide(FetchHttpClient.layer),
        Effect.mapError((error) =>
          error.code === 401
            ? new ListenError({
                code: 401,
                message: `Authentication rejected for ${environment}. Check POLAR_ACCESS_TOKEN or run polar auth login${production ? ' --production' : ''} --new-session.`,
              })
            : error,
        ),
      )
    }),
)
