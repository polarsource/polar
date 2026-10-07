import { createActor, type Actor } from './client/actor'
import type { RuntimeSDKConfig } from './schema/config'
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
export type { RuntimeSDKConfig } from './schema/config'

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
