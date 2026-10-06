import {
  createPolar,
  type Polar,
  type PolarOptions,
} from '@polar-sh/sdk/2026-10'

export {
  createPolar,
  createPolarCore,
  errors,
  webhooks,
} from '@polar-sh/sdk/2027-01'
export type {
  Environment,
  models,
  Polar,
  PolarCore,
  PolarOptions,
  RequestOptions,
} from '@polar-sh/sdk/2027-01'

export type MeterSDKConfig = {
  meters?: {
    id: string
    external_id: string
  }[]
}

type MeterSDKMeters = Record<
  string,
  { balance: () => Promise<number> } & NonNullable<
    MeterSDKConfig['meters']
  >[number]
>

type ActorCustomerIdentifier =
  | { externalCustomerId: string; customerId?: never }
  | { customerId: string; externalCustomerId?: never }
type ActorMemberIdentifier =
  | { externalMemberId?: string; memberId?: never }
  | { memberId?: string; externalMemberId?: never }

type ActorIdentifier = ActorCustomerIdentifier & ActorMemberIdentifier

type MeterSDKActor = (identifier: ActorIdentifier) => {
  meters: MeterSDKMeters
}

export function MeterSDK(
  config: MeterSDKConfig,
  sdkOptions: PolarOptions,
): {
  sdk: Polar
  actor: MeterSDKActor
} {
  const sdk = createPolar(sdkOptions)

  // Should we validate if an actor exists before we allow this?
  // Or do we `upsert` the actor
  // Also, for events, we allow external_customer_id
  const actor = (identifier: ActorIdentifier) => {
    const meters = config.meters?.reduce((acc, meter) => {
      acc[meter.external_id] = {
        ...meter,
        async balance() {
          const response = await sdk.customerMeters.list({
            ...(identifier.customerId
              ? { customer_id: identifier.customerId }
              : identifier.externalCustomerId
                ? { external_customer_id: identifier.externalCustomerId }
                : {}),
            meter_id: meter.id,
          })

          return response.items[0]?.balance ?? 0
        },
      }

      return acc
    }, {} as MeterSDKMeters)

    return {
      meters: meters ?? {},
    }
  }

  return { sdk, actor }
}
