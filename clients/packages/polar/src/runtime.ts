import { createActor, type Actor, type BenefitName } from './client/actor'
import {
  runtimeConfig,
  type DefinedConfig,
  type RuntimeSDKConfig,
} from './schema/runtime'
import { createPolar, type Polar, type PolarOptions } from './sdk'

export type RuntimeConnection<Config extends RuntimeSDKConfig> = {
  readonly sdk: Polar
  readonly actor: Actor<Config>
  readonly benefitKey: (benefit: {
    readonly external_id?: string | null
  }) => BenefitName<Config> | undefined
}

export function RuntimeSDK<Config extends RuntimeSDKConfig>(
  config: DefinedConfig<Config>,
  sdkOptions: PolarOptions,
): RuntimeConnection<Config> {
  const connected = config[runtimeConfig]()
  const sdk = createPolar(sdkOptions)
  const benefits = connected.benefits ?? {}
  return {
    sdk,
    actor: createActor(connected, sdk),
    benefitKey: ({ external_id }) =>
      typeof external_id === 'string' && Object.hasOwn(benefits, external_id)
        ? (external_id as BenefitName<Config>)
        : undefined,
  }
}
