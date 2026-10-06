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

import {
  createPolar,
  type Polar,
  type PolarOptions,
} from '@polar-sh/sdk/2026-10'

export type MeterSDKConfig = {
  events?: {
    name: string
  }[]
  meters?: {
    id: string
    external_id: string
    filter: {
      conjunction: 'and'
      clauses: {
        conjunction: 'or'
        clauses: {
          property: string
          operator: 'eq'
          value: string | number | boolean
        }[]
      }[]
    }
    aggregation: {
      func: 'count'
    }
  }[]
}

type MeterSDKMeters = Record<
  string,
  { balance: () => Promise<number> } & NonNullable<
    MeterSDKConfig['meters']
  >[number]
>

type MeterSDKEvents = Record<
  string,
  {
    ingest: () => Promise<number>
  }
>

type ActorCustomerIdentifier =
  | { externalCustomerId: string; customerId?: never }
  | { customerId: string; externalCustomerId?: never }
type ActorMemberIdentifier =
  | { externalMemberId: string; memberId?: never }
  | { memberId: string; externalMemberId?: never }
  | { memberId?: never; externalMemberId?: never }

type ActorIdentifier = ActorCustomerIdentifier & ActorMemberIdentifier

type MeterSDKActor = (identifier: ActorIdentifier) => {
  meters: MeterSDKMeters
  events: MeterSDKEvents
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
            ...(identifier.customerId !== undefined
              ? { customer_id: identifier.customerId }
              : { external_customer_id: identifier.externalCustomerId }),
            meter_id: meter.id,
          })

          return response.items[0]?.balance ?? 0
        },
      }

      return acc
    }, {} as MeterSDKMeters)

    const events = config.events?.reduce((acc, event) => {
      acc[event.name] = {
        async ingest() {
          const { inserted } = await sdk.events.ingest({
            events: [
              {
                ...(identifier.customerId !== undefined
                  ? { customer_id: identifier.customerId }
                  : { external_customer_id: identifier.externalCustomerId }),
                name: event.name,
              },
            ],
          })

          return inserted
        },
      }

      return acc
    }, {} as MeterSDKEvents)

    return {
      meters: meters ?? {},
      events: events ?? {},
    }
  }

  return { sdk, actor }
}
