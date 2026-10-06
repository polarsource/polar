import { getCustomerMeter } from '../internal/api/customer-meters'
import { ingestEvent } from '../internal/api/events'
import type {
  ActorSegment,
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

// Actor Path type definitions
//
// Force usage of externalIds and not polar internal ids if wanting to use path-like
// Will work with current event setup and create actor nodes for granular usage tracking
//
// it doesn't look great needing to write:
// const myAgent = polar.agent([{externalCustomerId: '123'}, { externalEntityId: '567'}])
//
// Might go with helpers but thats pretty tedious too. polar.agent([customer(123), member(456), entity(678)])
//
// Maybe a function syntax to skip importing? polar.agent(({customer, member}) => [customer(123), member(456)])
//
//
// Rules:
// Customer always idx 0.
// Member can be on idx 1 or 2.
// Entity can be on spot 1 and forward.
// If member is on idx 2 then an entity can be on idx 1 which simulates a 'team' or a 'workspace' that want to be a node for usage tracking. Up to implementator to decide

type PathCustomer = {
  externalCustomerId: string
  externalMemberId?: never
  externalEntityId?: never
}
type PathMember = {
  externalCustomerId?: never
  externalMemberId: string
  externalEntityId?: never
}
type PathEntity = {
  externalCustomerId?: never
  externalMemberId?: never
  externalEntityId: string
}

type ActorPath =
  | [PathCustomer, PathMember, ...PathEntity[]]
  | [PathCustomer, PathEntity, PathMember, ...PathEntity[]]
  | [PathCustomer, ...PathEntity[]]

type ActorIdentifier = ActorCustomerIdentifier & ActorMemberIdentifier

export type Actor<Config extends RuntimeSDKConfig> = (
  identifier: ActorIdentifier | ActorPath,
) => {
  meters: Meters<Config>
  events: Events<Config>
}

const toActorSegment = (
  segment: PathCustomer | PathMember | PathEntity,
): ActorSegment =>
  segment.externalCustomerId !== undefined
    ? { external_customer_id: segment.externalCustomerId }
    : segment.externalMemberId !== undefined
      ? { external_member_id: segment.externalMemberId }
      : { external_entity_id: segment.externalEntityId }

const resolveActor = (
  input: ActorIdentifier | ActorPath,
): { identifier: ActorIdentifier; actors?: ActorSegment[] } => {
  if (!Array.isArray(input) && input.customerId !== undefined) {
    return { identifier: input }
  }

  const path: ActorPath = Array.isArray(input)
    ? input
    : input.externalMemberId === undefined
      ? [{ externalCustomerId: input.externalCustomerId }]
      : [
          { externalCustomerId: input.externalCustomerId },
          { externalMemberId: input.externalMemberId },
        ]

  const [{ externalCustomerId }, ...rest] = path

  const externalMemberId = rest.find(
    (segment) => segment.externalMemberId,
  )?.externalMemberId

  return {
    identifier:
      externalMemberId === undefined
        ? { externalCustomerId }
        : { externalCustomerId, externalMemberId },
    actors: path.map(toActorSegment),
  }
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
  return (input) => {
    const { identifier, actors } = resolveActor(input)
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
          actors,
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
