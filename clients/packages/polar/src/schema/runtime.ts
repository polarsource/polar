import type { MeterAggregation, MeterFilter } from './meter'

export type EventConfig = Record<string, never>

export type RuntimeBenefitConfig = {
  readonly id?: string
}

export type RuntimeFilter = MeterFilter

export type RuntimeMeterConfig = {
  readonly filter: RuntimeFilter
  readonly aggregation: MeterAggregation
}

export type RuntimeSDKConfig = {
  readonly events?: Readonly<Record<string, EventConfig>>
  readonly benefits?: Readonly<Record<string, RuntimeBenefitConfig>>
  readonly meters?: Readonly<Record<string, RuntimeMeterConfig>>
}

export const runtimeConfig = Symbol('polar.runtimeConfig')

export type DefinedConfig<Config extends RuntimeSDKConfig> = {
  readonly [runtimeConfig]: () => Config
}
