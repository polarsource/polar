import type { StandardSchemaV1 } from '@standard-schema/spec'
import { Data, Predicate } from 'effect'
import {
  creditCustomerMeter,
  getCustomerMeter,
} from '../internal/api/customer-meters'
import { ingestEvents } from '../internal/api/events'
import {
  assertBenefitDeployed,
  findBenefitGrant,
} from '../internal/api/benefits'
import { getDeployedMeter } from '../internal/api/meters'
import { matchesMeter } from '../internal/meter'
import type {
  CustomerIdentifier,
  MemberIdentifier,
} from '../internal/api/utils'
import type { EventInput, EventMetadata, EventSchema } from '../schema/event'
import type { Metadata } from '../schema/metadata'
import type { EventConfig, RuntimeSDKConfig } from '../schema/runtime'
import type { models, Polar } from '../sdk'

export type MeterBalance = {
  balance: number
  pristine: boolean
}

const MAX_GRANT_UNITS = 1_000_000_000

export type GrantOptions = {
  // Defaults to false, like the API. True carries unused credits over to the
  // next meter period.
  rollover?: boolean
  // Retrying with the same key doesn't grant the credits twice
  idempotencyKey?: string
}

export type BenefitAccess<Values = models.MetadataOutputType> =
  | { granted: true; metadata: Values }
  | { granted: false }

export type BenefitName<Config extends RuntimeSDKConfig> = keyof NonNullable<
  Config['benefits']
> &
  string
type BenefitMetadata<
  Config extends RuntimeSDKConfig,
  Name extends BenefitName<Config>,
> = NonNullable<Config['benefits']>[Name] extends {
  readonly metadata: infer Values extends Metadata
}
  ? Values
  : models.MetadataOutputType
type MeterName<Config extends RuntimeSDKConfig> = keyof NonNullable<
  Config['meters']
> &
  string
type EventName<Config extends RuntimeSDKConfig> = Config extends {
  readonly events: infer Events
}
  ? keyof Events & string
  : string

type TrackArguments<
  Config extends RuntimeSDKConfig,
  Name extends string,
> = Config extends { readonly events: infer Events }
  ? Events[Name & keyof Events] extends infer Event extends EventSchema
    ? Partial<EventInput<Event>> extends EventInput<Event>
      ? [metadata?: EventInput<Event>]
      : [metadata: EventInput<Event>]
    : [metadata?: EventMetadata]
  : [metadata?: EventMetadata]

export type TrackedEvent<Config extends RuntimeSDKConfig> = {
  [Name in EventName<Config>]: TrackArguments<Config, Name> extends [
    infer Metadata,
  ]
    ? { name: Name; metadata: Metadata }
    : { name: Name; metadata?: TrackArguments<Config, Name>[0] }
}[EventName<Config>]

const formatPath = (path: StandardSchemaV1.Issue['path']) =>
  path
    ?.map((segment) => {
      const key = typeof segment === 'object' ? segment.key : segment
      return `[${typeof key === 'string' ? JSON.stringify(key) : String(key)}]`
    })
    .join('')

export class EventValidationError extends Data.TaggedError(
  'EventValidationError',
)<{
  readonly event: string
  readonly issues: readonly StandardSchemaV1.Issue[]
}> {
  override get message() {
    const issues = this.issues.map((issue) => {
      const path = formatPath(issue.path)
      return path ? `${issue.message}\n  at ${path}` : issue.message
    })
    return [`Invalid metadata for event "${this.event}"`, ...issues].join('\n')
  }
}

const isEventSchema = (event: EventConfig): event is EventSchema =>
  Predicate.hasProperty(event, '~standard')

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
  access: <Name extends BenefitName<Config>>(
    name: Name,
  ) => Promise<BenefitAccess<BenefitMetadata<Config, Name>>>
  balance: (name: MeterName<Config>) => Promise<MeterBalance>
  // Credits always go to the customer, even on an actor with a member
  grant: (
    name: MeterName<Config>,
    units: number,
    options?: GrantOptions,
  ) => Promise<void>
  track: {
    // Ingests all events in a single request
    (events: readonly TrackedEvent<Config>[]): Promise<void>
    <Name extends EventName<Config>>(
      name: Name,
      ...args: TrackArguments<Config, Name>
    ): Promise<void>
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

export const createActor = <Config extends RuntimeSDKConfig>(
  config: Config,
  sdk: Polar,
): Actor<Config> => {
  // Timestamp of the latest event ingested through this instance, per customer
  // and meter. The server processes events asynchronously, so a customer meter
  // last modified before this timestamp doesn't reflect that event yet.
  const latestIngestedAt = new Map<string, Date>()
  // Polar meter ID per deployed meter external ID
  const deployedMeters = new Map<string, string>()
  const deployedBenefits = new Set<string>()
  const cacheKey = (identifier: ActorIdentifier, externalMeterId: string) =>
    identifier.customerId !== undefined
      ? `customer:${identifier.customerId}:${externalMeterId}`
      : `external_customer:${identifier.externalCustomerId}:${externalMeterId}`
  const getDeployedMeterId = async (externalMeterId: string) => {
    const cached = deployedMeters.get(externalMeterId)
    if (cached !== undefined) return cached

    const { id } = await getDeployedMeter(sdk, externalMeterId)
    deployedMeters.set(externalMeterId, id)
    return id
  }
  const markIngested = (
    identifier: ActorIdentifier,
    externalMeterId: string,
    timestamp: Date,
  ) => {
    const key = cacheKey(identifier, externalMeterId)
    const current = latestIngestedAt.get(key)

    if (current === undefined || timestamp > current) {
      latestIngestedAt.set(key, timestamp)
    }
  }

  const validateEvent = async (
    name: string,
    input: unknown,
  ): Promise<EventMetadata | undefined> => {
    const event = config.events?.[name]
    if (config.events !== undefined && !Object.hasOwn(config.events, name)) {
      throw new Error(`Unknown event: ${name}`)
    }

    if (event === undefined || !isEventSchema(event)) {
      return input as EventMetadata | undefined
    }
    const result = await event['~standard'].validate(
      input === undefined ? {} : input,
    )
    if (result.issues !== undefined) {
      throw new EventValidationError({ event: name, issues: result.issues })
    }
    return result.value
  }

  const trackEvents = async (
    identifier: ActorIdentifier,
    tracked: readonly { name: string; metadata?: unknown }[],
  ) => {
    if (tracked.length === 0) return

    // Validate every event before ingesting any of them
    const timestamp = new Date()
    const events = await Promise.all(
      tracked.map(async ({ name, metadata }) => ({
        name,
        timestamp,
        metadata: await validateEvent(name, metadata),
      })),
    )

    const inserted = await ingestEvents(
      sdk,
      toMemberIdentifier(identifier),
      events,
    )

    if (inserted > 0) {
      for (const [externalId, meter] of Object.entries(config.meters ?? {})) {
        if (
          events.some(({ name, metadata }) =>
            matchesMeter(meter, { name, timestamp, metadata: metadata ?? {} }),
          )
        ) {
          markIngested(identifier, externalId, timestamp)
        }
      }
    }
  }

  // Should we validate if an actor exists before we allow this?
  // Or do we `upsert` the actor if it needs to be persisted
  // Also, for events, we allow external_customer_id
  return (identifier) => ({
    async access(name) {
      if (config.benefits?.[name] === undefined) {
        throw new Error(`Unknown benefit: ${name}`)
      }

      const grant = await findBenefitGrant(
        sdk,
        toMemberIdentifier(identifier),
        name,
      )
      // A missing grant means no access, unless the benefit itself isn't
      // deployed, which we check once per benefit.
      if (grant === undefined && !deployedBenefits.has(name)) {
        await assertBenefitDeployed(sdk, name)
      }
      deployedBenefits.add(name)

      // Deploying the config sets the benefit's metadata to the declared keys.
      return grant === undefined
        ? { granted: false }
        : {
            granted: true,
            metadata: grant.benefit.metadata as BenefitMetadata<
              Config,
              typeof name
            >,
          }
    },

    async balance(name) {
      if (config.meters?.[name] === undefined) {
        throw new Error(`Unknown meter: ${name}`)
      }

      // A customer meter only gets created in 2 cases:
      //
      // #1 - a benefit has granted meter credits for that meter -> customer meter gets created upon benefit grant
      // #2 - an event has been ingested that matches the meter's filter definition -> customer meter gets created
      //
      // So a missing customer meter means a zero balance, unless the meter
      // itself isn't deployed, which we check once per meter.
      const customerMeter = await getCustomerMeter(
        sdk,
        toCustomerIdentifier(identifier),
        name,
      )
      if (customerMeter === undefined) {
        await getDeployedMeterId(name)
      }

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

    async grant(name, units, { rollover = false, idempotencyKey } = {}) {
      if (config.meters?.[name] === undefined) {
        throw new Error(`Unknown meter: ${name}`)
      }
      if (!Number.isInteger(units) || units < 1 || units > MAX_GRANT_UNITS) {
        throw new Error(
          `Units must be a whole number from 1 to ${MAX_GRANT_UNITS}, got ${units}`,
        )
      }

      const event = await creditCustomerMeter(
        sdk,
        toCustomerIdentifier(identifier),
        { id: await getDeployedMeterId(name), externalId: name },
        { units, rollover, externalId: idempotencyKey },
      )
      markIngested(identifier, name, new Date(event.timestamp))
    },

    track: ((
      nameOrEvents: string | readonly TrackedEvent<Config>[],
      metadata?: EventMetadata,
    ) =>
      trackEvents(
        identifier,
        typeof nameOrEvents === 'string'
          ? [{ name: nameOrEvents, metadata }]
          : nameOrEvents,
      )) as ReturnType<Actor<Config>>['track'],
  })
}
