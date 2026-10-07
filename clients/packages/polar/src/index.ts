import { Schema } from 'effect'
import { PolarConfig } from './schema/config'

export { createPolar, createPolarCore, errors, webhooks } from './sdk'
export type {
  Environment,
  models,
  Polar,
  PolarCore,
  PolarOptions,
  RequestOptions,
} from './sdk'

export type { BenefitAccess, EventMetadata, MeterBalance } from './client/actor'
export type { RuntimeSDKConfig } from './schema/runtime'

export { RuntimeSDK } from './runtime'
export type { RuntimeConnection } from './runtime'

export {
  and,
  or,
  eq,
  ne,
  gt,
  gte,
  lt,
  lte,
  like,
  notLike,
  meter,
  MeterAggregation,
  MeterConfig,
  MeterFilter,
} from './schema/meter'
export type { MeterDefinition } from './schema/meter'
export { defineConfig, validateConfig } from './schema/config'
export type { Config } from './schema/config'
export { generateConfig } from './generate'
export { PolarConfig }

export const parseConfig = Schema.decodeUnknownEffect(
  Schema.fromJsonString(PolarConfig),
  { errors: 'all', onExcessProperty: 'error' },
)
