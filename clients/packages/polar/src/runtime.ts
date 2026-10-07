import { createActor, type Actor } from './client/actor'
import type { RuntimeSDKConfig } from './schema/runtime'
import { createPolar, type Polar, type PolarOptions } from './sdk'

export type RuntimeConnection<Config extends RuntimeSDKConfig> = {
  readonly sdk: Polar
  readonly actor: Actor<Config>
}

export function RuntimeSDK<const Config extends RuntimeSDKConfig>(
  config: Config,
  sdkOptions: PolarOptions,
): RuntimeConnection<Config> {
  const sdk = createPolar(sdkOptions)
  return { sdk, actor: createActor(config, sdk) }
}
