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
} from '@polar-sh/sdk/2027-01'

export type MeterSDKConfig = {
  events?: readonly {
    name: string
  }[]
  meters?: readonly {
    id: string
    external_id: string
    filter: {
      conjunction: 'and'
      clauses: readonly {
        conjunction: 'or'
        clauses: readonly {
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

type MeterSDKMeters<Config extends MeterSDKConfig> = {
  [Meter in Extract<
    NonNullable<Config['meters']>[number],
    { external_id: string }
  > as Meter['external_id']]: Meter & { balance: () => Promise<number> }
}

type MeterSDKEvents<Config extends MeterSDKConfig> = {
  ingest: (
    name: Extract<
      NonNullable<Config['events']>[number],
      { name: string }
    >['name'],
  ) => Promise<number>
}

type ActorCustomerIdentifier =
  | { externalCustomerId: string; customerId?: never }
  | { customerId: string; externalCustomerId?: never }
type ActorMemberIdentifier =
  | { externalMemberId: string; memberId?: never }
  | { memberId: string; externalMemberId?: never }
  | { memberId?: never; externalMemberId?: never }

type ActorIdentifier = ActorCustomerIdentifier & ActorMemberIdentifier

type MeterSDKActor<Config extends MeterSDKConfig> = (
  identifier: ActorIdentifier,
) => {
  meters: MeterSDKMeters<Config>
  events: MeterSDKEvents<Config>
}

export function MeterSDK<const Config extends MeterSDKConfig>(
  config: Config,
  sdkOptions: PolarOptions,
): {
  sdk: Polar
  actor: MeterSDKActor<Config>
} {
  const sdk = createPolar(sdkOptions)

  // Should we validate if an actor exists before we allow this?
  // Or do we `upsert` the actor if it needs to be persisted
  // Also, for events, we allow external_customer_id
  const actor = (identifier: ActorIdentifier) => {
    const meters = config.meters?.reduce(
      (acc, meter) => {
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
      },
      {} as Record<
        string,
        NonNullable<MeterSDKConfig['meters']>[number] & {
          balance: () => Promise<number>
        }
      >,
    )

    const events: MeterSDKEvents<Config> = {
      async ingest(name) {
        const { inserted } = await sdk.events.ingest({
          events: [
            {
              ...(identifier.customerId !== undefined
                ? { customer_id: identifier.customerId }
                : { external_customer_id: identifier.externalCustomerId }),
              name,
            },
          ],
        })

        return inserted
      },
    }

    return {
      meters: (meters ?? {}) as MeterSDKMeters<Config>,
      events,
    }
  }

  return { sdk, actor }
}
