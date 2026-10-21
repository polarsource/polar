import { Schema } from 'effect'
import type { models } from '../sdk'

export const WebhookFormat = Schema.Literals(['raw', 'discord', 'slack'])
export type WebhookFormat = typeof WebhookFormat.Type

export const WebhookConfig = Schema.Struct({
  external_id: Schema.String,
  url: Schema.String,
  format: WebhookFormat,
  events: Schema.Array(Schema.String),
  api_version: Schema.String,
})
export type WebhookConfig = typeof WebhookConfig.Type

export interface WebhookDefinition {
  readonly url: string
  readonly events: ReadonlyArray<models.WebhookEventType>
  readonly format?: WebhookFormat
  readonly api_version: string
}

export type WebhookEntries =
  | Readonly<Record<string, WebhookDefinition>>
  | ReadonlyArray<readonly [externalId: string, webhook: WebhookDefinition]>

export const webhookConfig = (
  external_id: string,
  { url, events, format = 'raw', api_version }: WebhookDefinition,
): WebhookConfig => ({ external_id, url, format, events, api_version })
