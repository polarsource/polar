import { Cause, Data, Duration, Effect, Exit, Schema, Stream } from 'effect'
import { Sse } from 'effect/unstable/encoding'
import { HttpClientRequest, HttpClientResponse } from 'effect/unstable/http'
import { type ActiveOrganization, loginCommand } from '@/schemas/Auth'
import {
  ListenAck,
  ListenReconnect,
  ListenWebhookEvent,
} from '@/schemas/Events'
import { apiUrl, withOrganization } from '@/services/api'
import { authenticatedClient } from '@/services/client'
import { Deliveries, type Delivery } from '@/services/deliveries'
import { redactUrl } from '@/utils/url'

export class ListenError extends Data.TaggedError('ListenError')<{
  message: string
  code: number
  cause?: unknown
}> {}

export type ListenEvent =
  | { _tag: 'Connected'; secret: string }
  | { _tag: 'Undecodable'; key: string | undefined }
  | {
      _tag: 'Forwarded'
      eventType: string
      status: number
      statusText: string
      durationMs: number
    }
  | {
      _tag: 'ForwardFailed'
      eventType: string
      reason: string
      durationMs: number
    }

const RESPONSE_BODY_LIMIT = 2000
const RESPONSE_BODY_TIMEOUT = '1 second'
const FORWARD_TIMEOUT = '10 seconds'

const readBody = (response: Response) =>
  Effect.gen(function* () {
    let text = ''
    yield* Effect.tryPromise(async (signal) => {
      const reader = response.body?.getReader()
      if (!reader) return
      signal.addEventListener('abort', () => void reader.cancel(), {
        once: true,
      })
      const decoder = new TextDecoder()
      while (text.length <= RESPONSE_BODY_LIMIT) {
        const { done, value } = await reader.read()
        if (done) return
        text += decoder.decode(value, { stream: true })
      }
      await reader.cancel()
    }).pipe(Effect.timeoutOption(RESPONSE_BODY_TIMEOUT), Effect.ignore)
    return text.length > RESPONSE_BODY_LIMIT
      ? `${text.slice(0, RESPONSE_BODY_LIMIT)}…`
      : text
  })

const refused = 'connection refused, is your server running?'

const failureHints = new Map([
  ['ConnectionRefused', refused],
  ['ECONNREFUSED', refused],
  ['ENOTFOUND', 'host not found, check the forward URL'],
])

const describeForwardFailure = (error: unknown) => {
  if (Cause.isTimeoutError(error)) return `no response after ${FORWARD_TIMEOUT}`
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

export interface StartListeningOptions {
  organization: ActiveOrganization
  forwardUrl: string
  onEvent: (event: ListenEvent) => Effect.Effect<void>
  forward?: (
    input: Parameters<typeof fetch>[0],
    init?: RequestInit,
  ) => Promise<Response>
}

export const startListening = ({
  organization,
  forwardUrl,
  onEvent,
  forward = fetch,
}: StartListeningOptions) =>
  Effect.gen(function* () {
    const { environment } = organization
    const listenUrl = yield* apiUrl(
      environment,
      `/cli/listen/${organization.id}`,
    )
    const client = yield* authenticatedClient(environment)
    const deliveries = yield* Deliveries
    const shownUrl = redactUrl(forwardUrl)
    let connected = false
    let retryDelay = Duration.millis(3000)
    let lastEventId: string | undefined
    const connection = Effect.scoped(
      Effect.gen(function* () {
        let request = HttpClientRequest.get(listenUrl).pipe(
          HttpClientRequest.setHeader('Accept', 'text/event-stream'),
          withOrganization(organization.id),
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
                yield* onEvent({ _tag: 'Undecodable', key: undefined })
                return
              }
              const json = decoded.value
              const ack = Schema.decodeUnknownExit(ListenAck)(json)
              if (Exit.isSuccess(ack)) {
                if (connected) return
                connected = true
                yield* onEvent({ _tag: 'Connected', secret: ack.value.secret })
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
                yield* onEvent({ _tag: 'Undecodable', key })
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
              const triggered =
                webhook.value.headers['x-polar-triggered'] === 'true'
              const record = (
                outcome: Pick<
                  Delivery,
                  'status' | 'statusText' | 'failure' | 'body'
                >,
              ) =>
                triggered
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
                  redirect: 'manual',
                  signal,
                }),
              ).pipe(
                Effect.timeout(FORWARD_TIMEOUT),
                Effect.flatMap((result) =>
                  (triggered && !result.ok
                    ? readBody(result)
                    : Effect.tryPromise(async () => {
                        await result.body?.cancel()
                        return ''
                      })
                  ).pipe(
                    Effect.tap(() =>
                      onEvent({
                        _tag: 'Forwarded',
                        eventType,
                        status: result.status,
                        statusText: result.statusText,
                        durationMs: performance.now() - startedAt,
                      }),
                    ),
                    Effect.flatMap((body) =>
                      record({
                        status: result.status,
                        statusText: result.statusText,
                        ...(body ? { body } : {}),
                      }),
                    ),
                  ),
                ),
                Effect.catch((error) => {
                  const failure = describeForwardFailure(error)
                  return onEvent({
                    _tag: 'ForwardFailed',
                    eventType,
                    reason: failure,
                    durationMs: performance.now() - startedAt,
                  }).pipe(Effect.andThen(record({ failure })))
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
    Effect.mapError((error) =>
      error.code === 401
        ? new ListenError({
            code: 401,
            message: `Authentication rejected for ${organization.environment}. Check POLAR_ACCESS_TOKEN or run ${loginCommand(organization.environment)} --new-session.`,
          })
        : error,
    ),
  )
