import { getCustomerMeter } from '../internal/api/customer-meters'
import { ingestEvent } from '../internal/api/events'
import type {
  CustomerIdentifier,
  MemberIdentifier,
} from '../internal/api/utils'
import type { MeterConfig, RuntimeSDKConfig } from '../schema/config'
import type { Polar } from '../sdk'

export type MeterBalance = {
  balance: number
  isPristine: boolean
}

type MeterConfigs<Config extends RuntimeSDKConfig> = NonNullable<
  Config['meters']
>

type Meters<Config extends RuntimeSDKConfig> = {
  [ExternalId in keyof MeterConfigs<Config> &
    string]: MeterConfigs<Config>[ExternalId] & {
    balance: () => Promise<MeterBalance>
  }
}

type Events<Config extends RuntimeSDKConfig> = {
  ingest: (
    name: keyof NonNullable<Config['events']> & string,
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

export type Actor<Config extends RuntimeSDKConfig> = (
  identifier: ActorIdentifier,
) => {
  meters: Meters<Config>
  events: Events<Config>
}

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
  filter: MeterConfig['filter'],
  event: Record<string, unknown>,
): boolean =>
  filter.clauses.every((group) =>
    group.clauses.some(
      (clause) =>
        clause.operator === 'eq' && event[clause.property] === clause.value,
    ),
  )

export const createActor = <Config extends RuntimeSDKConfig>(
  config: Config,
  sdk: Polar,
): Actor<Config> => {
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
  return (identifier) => {
    const meters = Object.entries(config.meters ?? {}).reduce(
      (acc, [externalId, meter]) => {
        acc[externalId] = {
          ...meter,
          async balance() {
            // To investigate: a customer meter only gets created in 2 cases:
            //
            // #1 - a benefit has granted meter credits for that meter -> customer meter gets created upon benefit grant
            // #2 - an event has been ingested that matches the meter's filter definition -> customer meter gets created
            const customerMeter = await getCustomerMeter(
              sdk,
              toCustomerIdentifier(identifier),
              meter.id,
            )

            const key = cacheKey(identifier, externalId)
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
        MeterConfig & { balance: () => Promise<MeterBalance> }
      >,
    )

    const events: Events<Config> = {
      async ingest(name) {
        const timestamp = new Date()

        const inserted = await ingestEvent(
          sdk,
          toMemberIdentifier(identifier),
          name,
          timestamp,
        )

        if (inserted > 0) {
          for (const [externalId, meter] of Object.entries(
            config.meters ?? {},
          )) {
            if (matchesFilter(meter.filter, { name })) {
              const key = cacheKey(identifier, externalId)
              const current = latestIngestedAt.get(key)

              if (current === undefined || timestamp > current) {
                latestIngestedAt.set(key, timestamp)
              }
            }
          }
        }

        return inserted
      },
    }

    return {
      meters: meters as Meters<Config>,
      events,
    }
  }
}
