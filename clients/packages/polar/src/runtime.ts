import { createActor, type Actor, type BenefitName } from './client/actor'
import { createWebhookRoute, type WebhookRoute } from './client/webhooks'
import {
  runtimeConfig,
  type DefinedConfig,
  type RuntimeSDKConfig,
} from './schema/runtime'
import { HandledWebhookEndpoint } from './schema/webhook'
import { createPolar, type Polar, type PolarOptions } from './sdk'

export type WebhookRoutes<Config extends RuntimeSDKConfig> = Config extends {
  readonly webhooks: infer Webhooks
}
  ? {
      readonly [Key in keyof Webhooks as Webhooks[Key] extends HandledWebhookEndpoint
        ? Key
        : never]: WebhookRoute
    }
  : Record<never, never>

export type RuntimeConnection<Config extends RuntimeSDKConfig> = {
  readonly sdk: Polar
  readonly actor: Actor<Config>
  readonly webhooks: WebhookRoutes<Config>
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
    webhooks: Object.fromEntries(
      Object.entries(connected.webhooks ?? {}).flatMap(([key, endpoint]) =>
        endpoint instanceof HandledWebhookEndpoint
          ? [[key, createWebhookRoute(key, endpoint)]]
          : [],
      ),
    ) as WebhookRoutes<Config>,
    benefitKey: ({ external_id }) =>
      typeof external_id === 'string' && Object.hasOwn(benefits, external_id)
        ? (external_id as BenefitName<Config>)
        : undefined,
  }
}
