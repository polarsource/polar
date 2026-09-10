import { Schema } from 'effect'

export const ListenAck = Schema.Struct({
  key: Schema.Literal('connected'),
  ts: Schema.DateFromString,
  secret: Schema.String,
})

export const ListenReconnect = Schema.Struct({
  type: Schema.Literal('reconnect'),
})

export const ListenWebhookEvent = Schema.Struct({
  id: Schema.String,
  key: Schema.String,
  payload: Schema.Struct({
    webhook_event_id: Schema.String,
    payload: Schema.String,
  }),
  headers: Schema.Record(Schema.String, Schema.String),
})

export const ListenEvent = Schema.Union([
  ListenAck,
  ListenReconnect,
  ListenWebhookEvent,
])
