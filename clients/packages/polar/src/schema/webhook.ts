import { Schema } from 'effect'
import type { webhooks } from '../sdk'
import {
  runtimeConfig,
  type DefinedConfig,
  type RuntimeSDKConfig,
} from './runtime'

export type WebhookEventType = webhooks.WebhookPayload['type']

export type WebhookEvent<Type extends WebhookEventType = WebhookEventType> =
  Extract<webhooks.WebhookPayload, { readonly type: Type }>

export type WebhookHandler<Type extends WebhookEventType = WebhookEventType> = (
  event: WebhookEvent<Type>,
) => unknown

export type WebhookHandlerLoader = () => Promise<unknown>

const EVENT_TYPES: Readonly<Record<WebhookEventType, null>> = {
  'checkout.created': null,
  'checkout.updated': null,
  'checkout.expired': null,
  'customer.created': null,
  'customer.updated': null,
  'customer.deleted': null,
  'customer.state_changed': null,
  'customer_seat.assigned': null,
  'customer_seat.claimed': null,
  'customer_seat.revoked': null,
  'member.created': null,
  'member.updated': null,
  'member.deleted': null,
  'order.created': null,
  'order.updated': null,
  'order.paid': null,
  'order.refunded': null,
  'subscription.created': null,
  'subscription.updated': null,
  'subscription.active': null,
  'subscription.canceled': null,
  'subscription.uncanceled': null,
  'subscription.cycled': null,
  'subscription.revoked': null,
  'subscription.past_due': null,
  'subscription.paused': null,
  'subscription.resumed': null,
  'subscription.migrated': null,
  'refund.created': null,
  'refund.updated': null,
  'product.created': null,
  'product.updated': null,
  'discount.created': null,
  'discount.updated': null,
  'discount.deleted': null,
  'benefit.created': null,
  'benefit.updated': null,
  'benefit_grant.created': null,
  'benefit_grant.cycled': null,
  'benefit_grant.updated': null,
  'benefit_grant.revoked': null,
  'organization.updated': null,
}

const WebhookFormat = Schema.Literals(['raw', 'discord', 'slack'])

type WebhookFormat = typeof WebhookFormat.Type

// Payload types come from the SDK this package is built against, so
// endpoints are pinned to that API version.
export const WEBHOOK_API_VERSION = '2027-01'

export const WebhookEndpointConfig = Schema.Struct({
  external_id: Schema.String.check(Schema.isMinLength(1)),
  url: Schema.String,
  format: WebhookFormat,
  events: Schema.Array(
    Schema.Literals(Object.keys(EVENT_TYPES) as Array<WebhookEventType>),
  ).check(Schema.isMinLength(1)),
  api_version: Schema.Literal(WEBHOOK_API_VERSION),
})

export type WebhookEndpointConfig = typeof WebhookEndpointConfig.Type

export class WebhookEndpointDefinition<
  Events extends WebhookEventType = WebhookEventType,
> {
  constructor(
    readonly url: string,
    readonly format: WebhookFormat,
    readonly events: ReadonlyArray<Events>,
  ) {}
}

export class HandledWebhookEndpoint<
  Events extends WebhookEventType = WebhookEventType,
> extends WebhookEndpointDefinition<Events> {
  constructor(
    url: string,
    events: ReadonlyArray<Events>,
    readonly secretEnv: string,
    readonly handler: WebhookHandlerLoader,
  ) {
    super(url, 'raw', events)
  }
}

class RawWebhookEndpoint<
  Events extends WebhookEventType,
> extends WebhookEndpointDefinition<Events> {
  constructor(
    url: string,
    events: ReadonlyArray<Events>,
    readonly secretEnv: string,
  ) {
    super(url, 'raw', events)
  }

  secret(env: string): RawWebhookEndpoint<Events> {
    return new RawWebhookEndpoint(this.url, this.events, env)
  }

  handle(handler: WebhookHandlerLoader): HandledWebhookEndpoint<Events> {
    return new HandledWebhookEndpoint(
      this.url,
      this.events,
      this.secretEnv,
      handler,
    )
  }
}

export const endpoint = (url: string) => ({
  on: <const Events extends WebhookEventType>(
    ...events: [Events, ...Array<Events>]
  ) => new RawWebhookEndpoint(url, events, 'POLAR_WEBHOOK_SECRET'),
})

const notification = (format: 'discord' | 'slack') => (url: string) => ({
  on: <const Events extends WebhookEventType>(
    ...events: [Events, ...Array<Events>]
  ) => new WebhookEndpointDefinition(url, format, events),
})

export const slack = notification('slack')
export const discord = notification('discord')

export type WebhookHelpers = {
  readonly endpoint: typeof endpoint
  readonly slack: typeof slack
  readonly discord: typeof discord
}

export type WebhookEntries = Readonly<Record<string, WebhookEndpointDefinition>>

type ConnectedWebhooks<Config> = Config extends {
  readonly [runtimeConfig]: () => infer Connected
}
  ? Connected extends { readonly webhooks: infer Webhooks }
    ? Webhooks
    : never
  : never

export type HandledWebhookKey<Config> = {
  [Key in keyof ConnectedWebhooks<Config>]: ConnectedWebhooks<Config>[Key] extends HandledWebhookEndpoint
    ? Key
    : never
}[keyof ConnectedWebhooks<Config>] &
  string

export type WebhookEventOf<
  Config,
  Key extends HandledWebhookKey<Config>,
> = WebhookEvent<
  ConnectedWebhooks<Config>[Key] extends HandledWebhookEndpoint<infer Events>
    ? Events
    : never
>

export const defineWebhookHandler = <
  Config extends DefinedConfig<RuntimeSDKConfig>,
  Key extends HandledWebhookKey<Config>,
>(
  handler: (event: WebhookEventOf<Config, Key>) => unknown,
): ((event: WebhookEventOf<Config, Key>) => unknown) => handler
