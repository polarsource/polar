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

export type RuntimeSDKConfig = {
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

type RuntimeSDKMeterConfig = NonNullable<RuntimeSDKConfig['meters']>[number]

export type MeterBalance = {
  balance: number
  isPristine: boolean
}

type RuntimeSDKMeters<Config extends RuntimeSDKConfig> = {
  [Meter in Extract<
    NonNullable<Config['meters']>[number],
    { external_id: string }
  > as Meter['external_id']]: Meter & { balance: () => Promise<MeterBalance> }
}

type RuntimeSDKEvents<Config extends RuntimeSDKConfig> = {
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

type CustomerIdentifier =
  | { customer_id: string }
  | { external_customer_id: string }
type MemberIdentifier = CustomerIdentifier &
  ({ member_id: string } | { external_member_id: string } | {})

const toCustomerIdentifier = (
  identifier: ActorIdentifier,
): CustomerIdentifier =>
  identifier.customerId !== undefined
    ? { customer_id: identifier.customerId }
    : { external_customer_id: identifier.externalCustomerId }

const toMemberIdentifier = (identifier: ActorIdentifier): MemberIdentifier => ({
  // Always require a customer identifier on a member too
  ...toCustomerIdentifier(identifier),
  ...(identifier.memberId !== undefined
    ? { member_id: identifier.memberId }
    : identifier.externalMemberId !== undefined
      ? { external_member_id: identifier.externalMemberId }
      : {}),
})

// Vibe-coded alert
const matchesFilter = (
  filter: RuntimeSDKMeterConfig['filter'],
  event: Record<string, unknown>,
): boolean =>
  filter.clauses.every((group) =>
    group.clauses.some(
      (clause) =>
        clause.operator === 'eq' && event[clause.property] === clause.value,
    ),
  )

type RuntimeSDKActor<Config extends RuntimeSDKConfig> = (
  identifier: ActorIdentifier,
) => {
  meters: RuntimeSDKMeters<Config>
  events: RuntimeSDKEvents<Config>
}

export function RuntimeSDK<const Config extends RuntimeSDKConfig>(
  config: Config,
  sdkOptions: PolarOptions,
): {
  sdk: Polar
  actor: RuntimeSDKActor<Config>
} {
  const sdk = createPolar(sdkOptions)

  // Timestamp of the latest event ingested through this instance, per customer
  // and meter. The server processes events asynchronously, so a customer meter
  // last modified before this timestamp doesn't reflect that event yet.
  const latestIngestedAt = new Map<string, Date>()
  const cacheKey = (identifier: ActorIdentifier, meterId: string) =>
    identifier.customerId !== undefined
      ? `customer:${identifier.customerId}:${meterId}`
      : `external_customer:${identifier.externalCustomerId}:${meterId}`

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
              ...toCustomerIdentifier(identifier),
              meter_id: meter.id,
            })

            // To investigate: a customer meter only gets created in 2 cases:
            //
            // #1 - a benefit has granted meter credits for that meter -> customer meter gets created upon benefit grant
            // #2 - an event has been ingested that matches the meter's filter definition -> customer meter gets created

            const customerMeter = response.items[0]
            const key = cacheKey(identifier, meter.external_id)
            const ingestedAt = latestIngestedAt.get(key)

            const updatedAt = customerMeter
              ? new Date(customerMeter.modified_at ?? customerMeter.created_at)
              : undefined
            const isPristine =
              ingestedAt === undefined ||
              (updatedAt !== undefined && updatedAt >= ingestedAt)

            if (isPristine) {
              latestIngestedAt.delete(key)
            }

            return {
              balance: customerMeter?.balance ?? 0,
              isPristine,
            }
          },
        }

        return acc
      },
      {} as Record<
        string,
        RuntimeSDKMeterConfig & { balance: () => Promise<MeterBalance> }
      >,
    )

    const events: RuntimeSDKEvents<Config> = {
      async ingest(name) {
        const timestamp = new Date()

        const { inserted } = await sdk.events.ingest({
          events: [
            {
              ...toMemberIdentifier(identifier),
              name,
              timestamp: timestamp.toISOString(),
            },
          ],
        })

        if (inserted > 0) {
          for (const meter of config.meters ?? []) {
            if (matchesFilter(meter.filter, { name })) {
              latestIngestedAt.set(
                cacheKey(identifier, meter.external_id),
                timestamp,
              )
            }
          }
        }

        return inserted
      },
    }

    return {
      meters: (meters ?? {}) as RuntimeSDKMeters<Config>,
      events,
    }
  }

  return { sdk, actor }
}
