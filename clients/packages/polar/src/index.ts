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

export { MeterAggregation, MeterConfig, MeterFilter } from './schema/meter'
export { PolarConfig }

export const validateConfig = Schema.decodeUnknownEffect(PolarConfig, {
  errors: 'all',
  onExcessProperty: 'error',
})

export const parseConfig = Schema.decodeUnknownEffect(
  Schema.fromJsonString(PolarConfig),
  { errors: 'all', onExcessProperty: 'error' },
)
