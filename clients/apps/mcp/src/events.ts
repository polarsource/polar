import {
  type McpServer,
  ProtocolError,
  ProtocolErrorCode,
  type ServerCapabilities,
} from '@modelcontextprotocol/server'
import { Effect, Schema } from 'effect'
import { HttpClientRequest, HttpClientResponse } from 'effect/http'
import { isRecord } from './json'
import { polarApiClient, type PolarApiOutboundProps } from './outbound'

// ChatGPT's MCP events docs use -32015; the protocol draft uses -32027.
const CALLBACK_ENDPOINT_ERROR = -32015
const NOT_FOUND = -32023
const FORBIDDEN = -32024
const UNSUPPORTED = -32026

const Delivery = Schema.Struct({
  mode: Schema.String,
  url: Schema.optionalKey(Schema.String),
})

const SubscriptionParams = Schema.Struct({
  name: Schema.String,
  arguments: Schema.optionalKey(Schema.JsonObject),
  delivery: Delivery,
})

const SubscribeParams = Schema.Struct({
  ...SubscriptionParams.fields,
  delivery: Schema.Struct({
    ...Delivery.fields,
    secret: Schema.optionalKey(Schema.String),
  }),
  ttlMs: Schema.optionalKey(Schema.NullOr(Schema.Number)),
})

const EventCatalog = Schema.Struct({
  items: Schema.Array(
    Schema.Struct({
      name: Schema.String,
      description: Schema.String,
      input_schema: Schema.JsonObject,
      payload_schema: Schema.JsonObject,
    }),
  ),
})

const Subscription = Schema.Struct({
  id: Schema.String,
  expires_at: Schema.String,
})

const apiError = (status: number, body: unknown) => {
  const error = isRecord(body) ? body.error : undefined
  const detail = isRecord(body) ? body.detail : undefined
  const message =
    typeof detail === 'string' ? detail : `Polar API returned ${status}`
  switch (status) {
    case 400:
      return error === 'CallbackEndpointError'
        ? new ProtocolError(CALLBACK_ENDPOINT_ERROR, message, {
            reason: detail,
          })
        : new ProtocolError(ProtocolErrorCode.InternalError, message)
    case 403:
      return new ProtocolError(FORBIDDEN, message)
    case 404:
      return new ProtocolError(NOT_FOUND, message, { kind: 'event' })
    case 422:
      return new ProtocolError(ProtocolErrorCode.InvalidParams, message)
    default:
      return new ProtocolError(ProtocolErrorCode.InternalError, message)
  }
}

const webhookDelivery = <D extends typeof Delivery.Type>(
  delivery: D,
): Effect.Effect<D, ProtocolError> =>
  delivery.mode === 'webhook'
    ? Effect.succeed(delivery)
    : Effect.fail(
        new ProtocolError(
          UNSUPPORTED,
          `Unsupported delivery mode: ${delivery.mode}`,
        ),
      )

export const registerEvents = Effect.fn('registerEvents')(function* (
  server: McpServer,
  { apiUrl, token }: PolarApiOutboundProps,
) {
  const client = yield* polarApiClient(token)

  const send = (request: HttpClientRequest.HttpClientRequest) =>
    client.execute(request).pipe(
      Effect.flatMap((response) =>
        response.status >= 200 && response.status < 300
          ? Effect.succeed(response)
          : response.json.pipe(
              Effect.orElseSucceed(() => undefined),
              Effect.flatMap((body) =>
                Effect.fail(apiError(response.status, body)),
              ),
            ),
      ),
    )

  const post = (path: string, body: unknown) =>
    send(
      HttpClientRequest.post(`${apiUrl}/v1/mcp/events/${path}`).pipe(
        HttpClientRequest.bodyJsonUnsafe(body),
      ),
    )

  server.server.registerCapabilities({ events: {} } as ServerCapabilities)

  server.server.setRequestHandler(
    'events/list',
    { params: Schema.toStandardSchemaV1(Schema.Struct({})) },
    (_, context) =>
      Effect.runPromise(
        send(HttpClientRequest.get(`${apiUrl}/v1/mcp/events/`)).pipe(
          Effect.flatMap(HttpClientResponse.schemaBodyJson(EventCatalog)),
          Effect.map(({ items }) => ({
            events: items.map((event) => ({
              name: event.name,
              description: event.description,
              delivery: ['webhook'],
              inputSchema: event.input_schema,
              payloadSchema: event.payload_schema,
            })),
          })),
        ),
        { signal: context.mcpReq.signal },
      ),
  )

  server.server.setRequestHandler(
    'events/subscribe',
    { params: Schema.toStandardSchemaV1(SubscribeParams) },
    (params, context) =>
      Effect.runPromise(
        webhookDelivery(params.delivery).pipe(
          Effect.flatMap((delivery) =>
            post('subscribe', {
              name: params.name,
              arguments: params.arguments ?? {},
              url: delivery.url,
              secret: delivery.secret,
              ttl_ms: params.ttlMs ?? null,
            }),
          ),
          Effect.flatMap(HttpClientResponse.schemaBodyJson(Subscription)),
          Effect.map(({ id, expires_at }) => ({
            id,
            refreshBefore: expires_at,
            cursor: null,
            truncated: false,
          })),
        ),
        { signal: context.mcpReq.signal },
      ),
  )

  server.server.setRequestHandler(
    'events/unsubscribe',
    { params: Schema.toStandardSchemaV1(SubscriptionParams) },
    (params, context) =>
      Effect.runPromise(
        webhookDelivery(params.delivery).pipe(
          Effect.flatMap((delivery) =>
            post('unsubscribe', {
              name: params.name,
              arguments: params.arguments ?? {},
              url: delivery.url,
            }),
          ),
          Effect.as({}),
        ),
        { signal: context.mcpReq.signal },
      ),
  )
})
