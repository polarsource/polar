import { getCustomerMeter } from '../internal/api/customer-meters'
import { ingestEvent } from '../internal/api/events'
import { findBenefitGrant } from '../internal/api/benefits'
import type {
  CustomerIdentifier,
  MemberIdentifier,
} from '../internal/api/utils'
import type { MeterConfig, RuntimeSDKConfig } from '../schema/config'
import type { models, Polar } from '../sdk'

export type MeterBalance = {
  balance: number
  pristine: boolean
}

export type BenefitDetails =
  | { granted: true; metadata: models.MetadataOutputType }
  | { granted: false }

export type EventMetadata = models.EventMetadataInput

type BenefitName<Config extends RuntimeSDKConfig> = keyof NonNullable<
  Config['benefits']
> &
  string
type MeterName<Config extends RuntimeSDKConfig> = keyof NonNullable<
  Config['meters']
> &
  string
type EventName<Config extends RuntimeSDKConfig> = keyof NonNullable<
  Config['events']
> &
  string

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
  has: (name: BenefitName<Config>) => Promise<boolean>
  benefit: (name: BenefitName<Config>) => Promise<BenefitDetails>
  balance: (name: MeterName<Config>) => Promise<MeterBalance>
  track: (name: EventName<Config>, metadata?: EventMetadata) => Promise<void>
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

  const findGrant = (identifier: ActorIdentifier, name: string) => {
    const benefit = config.benefits?.[name]
    if (benefit === undefined) {
      throw new Error(`Unknown benefit: ${name}`)
    }

    return findBenefitGrant(sdk, toMemberIdentifier(identifier), benefit.id)
  }

  // Should we validate if an actor exists before we allow this?
  // Or do we `upsert` the actor if it needs to be persisted
  // Also, for events, we allow external_customer_id
  return (identifier) => ({
    async has(name) {
      const grant = await findGrant(identifier, name)
      return grant !== undefined
    },

    async benefit(name) {
      const grant = await findGrant(identifier, name)
      return grant === undefined
        ? { granted: false }
        : { granted: true, metadata: grant.benefit.metadata }
    },

    async balance(name) {
      const meter = config.meters?.[name]
      if (meter === undefined) {
        throw new Error(`Unknown meter: ${name}`)
      }

      // To investigate: a customer meter only gets created in 2 cases:
      //
      // #1 - a benefit has granted meter credits for that meter -> customer meter gets created upon benefit grant
      // #2 - an event has been ingested that matches the meter's filter definition -> customer meter gets created
      const customerMeter = await getCustomerMeter(
        sdk,
        toCustomerIdentifier(identifier),
        meter.id,
      )

      const key = cacheKey(identifier, name)
      const ingestedAt = latestIngestedAt.get(key)

      const updatedAt = customerMeter
        ? new Date(customerMeter.modified_at ?? customerMeter.created_at)
        : undefined
      const pristine =
        ingestedAt === undefined ||
        (updatedAt !== undefined && updatedAt >= ingestedAt)

      if (pristine) {
        latestIngestedAt.delete(key)
      }

      return {
        balance: customerMeter?.balance ?? 0,
        pristine,
      }
    },

    async track(name, metadata) {
      const timestamp = new Date()

      const inserted = await ingestEvent(
        sdk,
        toMemberIdentifier(identifier),
        name,
        timestamp,
        metadata,
      )

      if (inserted > 0) {
        for (const [externalId, meter] of Object.entries(config.meters ?? {})) {
          if (matchesFilter(meter.filter, { ...metadata, name })) {
            const key = cacheKey(identifier, externalId)
            const current = latestIngestedAt.get(key)

            if (current === undefined || timestamp > current) {
              latestIngestedAt.set(key, timestamp)
            }
          }
        }
      }
    },
  })
}
