import { createActor, type Actor, type BenefitName } from './client/actor'
import { createWebhookRoute, type WebhookRoute } from './client/webhooks'
import {
  runtimeConfig,
  type DefinedConfig,
  type RuntimeSDKConfig,
} from './schema/runtime'
import { HandledWebhookEndpoint } from './schema/webhook'
import {
  createPolar,
  type Metering,
  type MeteringOptions,
  type Polar,
  type PolarOptions,
} from './sdk'

export type RuntimeSDKOptions = PolarOptions & {
  metering?: MeteringOptions
}

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
  // Waits until tracked events are delivered. Call it before a serverless
  // handler returns, e.g. in Next.js `after()`.
  readonly flush: () => Promise<void>
  readonly close: () => Promise<void>
}

export function RuntimeSDK<Config extends RuntimeSDKConfig>(
  config: DefinedConfig<Config>,
  { metering: meteringOptions, ...sdkOptions }: RuntimeSDKOptions,
): RuntimeConnection<Config> {
  const connected = config[runtimeConfig]()
  const sdk = createPolar(sdkOptions)
  const benefits = connected.benefits ?? {}
  let metering: Metering | undefined
  const getMetering = () => (metering ??= sdk.metering(meteringOptions))
  return {
    sdk,
    actor: createActor(connected, sdk, getMetering),
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
    flush: async () => {
      await metering?.flush()
    },
    close: async () => {
      const closing = metering
      metering = undefined
      await closing?.close()
    },
  }
}
