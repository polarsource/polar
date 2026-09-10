import { Data, Duration, Effect, Exit, Schema, Stream } from 'effect'
import { Sse } from 'effect/unstable/encoding'
import { HttpClientRequest, HttpClientResponse } from 'effect/unstable/http'
import type { PolarEnvironment } from '@/schemas/Auth'
import {
  ListenAck,
  ListenReconnect,
  ListenWebhookEvent,
} from '@/schemas/Events'
import { authenticatedClient } from '@/services/client'

export class ListenError extends Data.TaggedError('ListenError')<{
  message: string
  code: number
  cause?: unknown
}> {}

export interface ListenConnection {
  organizationName: string
  secret: string
  forwardUrl: string
}

export interface ForwardedEvent {
  type: string
  status: number
  statusText: string
  durationMs: number
}

export interface FailedForward {
  type: string
  error: unknown
  durationMs: number
}

export interface ListenReporter {
  connected: (connection: ListenConnection) => Effect.Effect<void>
  forwarded: (event: ForwardedEvent) => Effect.Effect<void>
  forwardFailed: (event: FailedForward) => Effect.Effect<void>
  undecodable: (key: string | undefined) => Effect.Effect<void>
}

export interface StartListeningOptions {
  listenUrl: string
  forwardUrl: string
  organizationName: string
  environment: PolarEnvironment
  forward?: (
    input: Parameters<typeof fetch>[0],
    init?: RequestInit,
  ) => Promise<Response>
  report: ListenReporter
}

export const startListening = ({
  listenUrl,
  forwardUrl,
  organizationName,
  environment,
  forward = fetch,
  report,
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
                yield* report.undecodable(undefined)
                return
              }
              const json = decoded.value
              const ack = Schema.decodeUnknownExit(ListenAck)(json)
              if (Exit.isSuccess(ack)) {
                if (bannerShown) return
                bannerShown = true
                yield* report.connected({
                  organizationName,
                  secret: ack.value.secret,
                  forwardUrl,
                })
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
                yield* report.undecodable(key)
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
                      report.forwarded({
                        type: eventType,
                        status: result.status,
                        statusText: result.statusText,
                        durationMs: performance.now() - startedAt,
                      }),
                    ),
                  ),
                ),
                Effect.catch((error) =>
                  report.forwardFailed({
                    type: eventType,
                    error,
                    durationMs: performance.now() - startedAt,
                  }),
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
