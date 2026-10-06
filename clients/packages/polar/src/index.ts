import { Schema } from 'effect'
import { createActor, type Actor } from './client/actor'
import { PolarConfig } from './schema/config'
import type { RuntimeSDKConfig } from './schema/runtime'
import { createPolar, type Polar, type PolarOptions } from './sdk'

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

export function RuntimeSDK<const Config extends RuntimeSDKConfig>(
  config: Config,
  sdkOptions: PolarOptions,
): {
  sdk: Polar
  actor: Actor<Config>
} {
  const sdk = createPolar(sdkOptions)

  return { sdk, actor: createActor(config, sdk) }
}

export {
  eq,
  ne,
  gt,
  gte,
  lt,
  lte,
  like,
  notLike,
  fold,
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
