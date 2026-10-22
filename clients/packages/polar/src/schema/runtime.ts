import type { EventSchema } from './event'
import type { MeterAggregation, MeterFilter } from './meter'
import type { WebhookEndpointDefinition } from './webhook'

export type EventConfig = EventSchema | Record<string, never>

export type RuntimeBenefitConfig = object

export type RuntimeFilter = MeterFilter

export type RuntimeMeterConfig = {
  readonly filter: RuntimeFilter
  readonly aggregation: MeterAggregation
}

export type RuntimeSDKConfig = {
  readonly events?: Readonly<Record<string, EventConfig>>
  readonly benefits?: Readonly<Record<string, RuntimeBenefitConfig>>
  readonly meters?: Readonly<Record<string, RuntimeMeterConfig>>
  readonly webhooks?: Readonly<Record<string, WebhookEndpointDefinition>>
}

export const runtimeConfig = Symbol('polar.runtimeConfig')

export type DefinedConfig<Config extends RuntimeSDKConfig> = {
  readonly [runtimeConfig]: () => Config
}
