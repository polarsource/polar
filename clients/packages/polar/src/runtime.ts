import { createActor, type Actor } from './client/actor'
import {
  runtimeConfig,
  type DefinedConfig,
  type RuntimeSDKConfig,
} from './schema/runtime'
import { createPolar, type Polar, type PolarOptions } from './sdk'

export type RuntimeConnection<Config extends RuntimeSDKConfig> = {
  readonly sdk: Polar
  readonly actor: Actor<Config>
}

export function RuntimeSDK<Config extends RuntimeSDKConfig>(
  config: DefinedConfig<Config>,
  sdkOptions: PolarOptions,
): RuntimeConnection<Config> {
  const sdk = createPolar(sdkOptions)
  return { sdk, actor: createActor(config[runtimeConfig](), sdk) }
}
