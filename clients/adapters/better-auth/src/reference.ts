import type { models } from '@polar-sh/sdk/2026-10'
import type { AuthContext, Session, User } from 'better-auth'
import type { Member } from 'better-auth/plugins/organization'
import {
  getBetterAuthCreatorRole,
  getBetterAuthOrganizationPlugin,
} from './organization/roles'
import type { PolarOrganizationRoleSyncOptions } from './organization/types'
import { type BillingPrincipalSession, isBillingRole } from './principal'

/**
 * What a caller may read about the subscriptions tagged with a reference ID.
 *
 * - `full`: every subscription, including customer billing details.
 * - `redacted`: every subscription, without customer billing details.
 *   Subscriptions the caller purchased keep their billing details.
 * - `purchased`: only the subscriptions the caller purchased.
 * - `none`: the request is rejected.
 */
export type ReferenceAccess = 'full' | 'redacted' | 'purchased' | 'none'

/**
 * How the adapter classified the reference ID.
 *
 * - `self`: the signed-in user's ID.
 * - `organization`: a Better Auth organization.
 * - `user`: another Better Auth user.
 * - `unknown`: an ID the adapter cannot resolve, such as a workspace or
 *   project ID from your own tables.
 */
export type ReferenceType = 'self' | 'organization' | 'user' | 'unknown'

export interface AuthorizeReferenceInput {
  user: User
  session: Session
  referenceId: string
  action: 'list-subscriptions'
  referenceType: ReferenceType
  /** The access the adapter grants when this function is not configured. */
  defaultAccess: ReferenceAccess
}

export type AuthorizeReference = (
  input: AuthorizeReferenceInput,
  request?: Request,
) => boolean | ReferenceAccess | Promise<boolean | ReferenceAccess>

export interface ResolveReferenceAccessInput {
  context: Pick<AuthContext, 'adapter' | 'getPlugin' | 'internalAdapter'>
  session: { user: BillingPrincipalSession['user']; session: Session }
  referenceId: string
  mapBetterAuthRoleToPolarRole?:
    | PolarOrganizationRoleSyncOptions['mapBetterAuthRoleToPolarRole']
    | undefined
  authorizeReference?: AuthorizeReference | undefined
  request?: Request | undefined
}

export interface ResolvedReferenceAccess {
  access: ReferenceAccess
  referenceType: ReferenceType
  /** The access relies on the unauthorized fallback for unknown references. */
  unauthorizedFallback: boolean
}

const SUBSCRIPTION_ENTITLEMENT_KEYS = [
  'created_at',
  'modified_at',
  'id',
  'amount',
  'currency',
  'recurring_interval',
  'recurring_interval_count',
  'status',
  'current_period_start',
  'current_period_end',
  'current_meter_period_start',
  'current_meter_period_end',
  'trial_start',
  'trial_end',
  'cancel_at_period_end',
  'canceled_at',
  'started_at',
  'ends_at',
  'ended_at',
  'past_due_at',
  'pause_at_period_end',
  'paused_at',
  'resumes_at',
  'customer_id',
  'product_id',
  'discount_id',
  'checkout_id',
  'seats',
  'units',
  'prices',
  'pending_update',
] as const satisfies readonly (keyof models.Subscription &
  keyof models.CustomerSubscription)[]

const PRODUCT_ENTITLEMENT_KEYS = [
  'id',
  'created_at',
  'modified_at',
  'trial_interval',
  'trial_interval_count',
  'name',
  'description',
  'visibility',
  'recurring_interval',
  'recurring_interval_count',
  'meter_interval',
  'meter_interval_count',
  'is_recurring',
  'is_archived',
  'organization_id',
  'prices',
  'medias',
] as const satisfies readonly (keyof models.Product &
  keyof models.CustomerSubscriptionProduct)[]

const BENEFIT_ENTITLEMENT_KEYS = [
  'id',
  'created_at',
  'modified_at',
  'type',
  'description',
  'selectable',
  'deletable',
  'is_deleted',
  'organization_id',
] as const satisfies readonly (keyof models.Benefit &
  keyof models.BenefitPublic)[]

const SUBSCRIPTION_METER_ENTITLEMENT_KEYS = [
  'created_at',
  'modified_at',
  'id',
  'consumed_units',
  'credited_units',
  'amount',
  'meter_id',
] as const satisfies readonly (keyof models.SubscriptionMeter &
  keyof models.CustomerSubscriptionMeter)[]

const METER_ENTITLEMENT_KEYS = [
  'created_at',
  'modified_at',
  'id',
  'name',
] as const satisfies readonly (keyof models.Meter &
  keyof models.CustomerSubscriptionMeterMeter)[]

type BillingOnlyKey =
  | 'customer'
  | 'discount'
  | 'custom_field_data'
  | 'customer_cancellation_reason'
  | 'customer_cancellation_comment'

/**
 * A subscription listed by `reference_id`.
 *
 * Customer billing details are only present for callers with billing access
 * and on subscriptions the caller purchased.
 */
export type ReferenceSubscription = Pick<
  models.Subscription,
  (typeof SUBSCRIPTION_ENTITLEMENT_KEYS)[number]
> &
  Partial<Pick<models.Subscription, BillingOnlyKey>> & {
    metadata: models.Subscription['metadata']
    product: Pick<models.Product, (typeof PRODUCT_ENTITLEMENT_KEYS)[number]> & {
      benefits: Pick<
        models.Benefit,
        (typeof BENEFIT_ENTITLEMENT_KEYS)[number]
      >[]
    }
    meters: (Pick<
      models.SubscriptionMeter,
      (typeof SUBSCRIPTION_METER_ENTITLEMENT_KEYS)[number]
    > & {
      meter: Pick<models.Meter, (typeof METER_ENTITLEMENT_KEYS)[number]>
    })[]
  }

export interface ListResourceReferenceSubscription {
  items: ReferenceSubscription[]
  pagination: models.ListResourceSubscription['pagination']
}

const pick = <T extends object, K extends keyof T>(
  source: T,
  keys: readonly K[],
): Pick<T, K> => {
  const result = {} as Pick<T, K>
  for (const key of keys) {
    if (key in source) {
      result[key] = source[key]
    }
  }
  return result
}

/**
 * Keep the fields Polar's customer portal exposes for a subscription.
 *
 * Fields are picked rather than removed so that fields added to the merchant
 * API later stay private until they are listed here.
 */
export const toEntitlementSubscription = (
  subscription: models.Subscription,
  referenceId: string,
): ReferenceSubscription => ({
  ...pick(subscription, SUBSCRIPTION_ENTITLEMENT_KEYS),
  metadata: { referenceId },
  product: {
    ...pick(subscription.product, PRODUCT_ENTITLEMENT_KEYS),
    benefits: subscription.product.benefits.map((benefit) =>
      pick(benefit, BENEFIT_ENTITLEMENT_KEYS),
    ),
  },
  meters: subscription.meters.map((subscriptionMeter) => ({
    ...pick(subscriptionMeter, SUBSCRIPTION_METER_ENTITLEMENT_KEYS),
    meter: pick(subscriptionMeter.meter, METER_ENTITLEMENT_KEYS),
  })),
})

const normalizeReferenceAccess = (
  access: boolean | ReferenceAccess,
): ReferenceAccess => {
  if (access === true) return 'redacted'
  if (access === false) return 'none'
  return access
}

// Postgres `invalid_text_representation` (uuid/integer columns) and Prisma's
// equivalent. MongoDB raises a BSONError for IDs that aren't ObjectIds.
const INVALID_ID_ERROR_CODES = new Set(['22P02', 'P2023'])

const isInvalidIdError = (error: unknown): boolean => {
  let current = error
  for (let depth = 0; current instanceof Object && depth < 5; depth++) {
    const { code, name, cause } = current as {
      code?: unknown
      name?: unknown
      cause?: unknown
    }
    if (
      (typeof code === 'string' && INVALID_ID_ERROR_CODES.has(code)) ||
      name === 'BSONError'
    ) {
      return true
    }
    current = cause
  }
  return false
}

const findOrNull = async <T>(lookup: () => Promise<T | null>) => {
  try {
    return await lookup()
  } catch (error) {
    // Reference IDs are opaque: one that doesn't fit the ID column's type is
    // not a Better Auth organization or user. Any other failure must not
    // downgrade a real organization to an unknown reference.
    if (isInvalidIdError(error)) return null
    throw error
  }
}

const classifyReference = async ({
  context,
  session,
  referenceId,
  mapBetterAuthRoleToPolarRole,
}: ResolveReferenceAccessInput): Promise<
  Pick<ResolvedReferenceAccess, 'access' | 'referenceType'>
> => {
  const { user } = session

  if (referenceId === user.id) {
    return { referenceType: 'self', access: 'redacted' }
  }

  if (getBetterAuthOrganizationPlugin(context)) {
    const membership = await findOrNull(() =>
      context.adapter.findOne<Member>({
        model: 'member',
        where: [
          { field: 'userId', value: user.id },
          { field: 'organizationId', value: referenceId },
        ],
      }),
    )

    if (membership) {
      const billing = await isBillingRole(membership.role, referenceId, user, {
        creatorRole: getBetterAuthCreatorRole(context),
        mapBetterAuthRoleToPolarRole,
      })
      return {
        referenceType: 'organization',
        access: billing ? 'full' : 'redacted',
      }
    }

    const organization = await findOrNull(() =>
      context.adapter.findOne<{ id: string }>({
        model: 'organization',
        where: [{ field: 'id', value: referenceId }],
      }),
    )

    if (organization) {
      return { referenceType: 'organization', access: 'purchased' }
    }
  }

  const referencedUser = await findOrNull(() =>
    context.internalAdapter.findUserById(referenceId),
  )

  return {
    referenceType: referencedUser ? 'user' : 'unknown',
    access: 'purchased',
  }
}

/**
 * Decide what the signed-in user may read for a `reference_id`.
 *
 * Without `authorizeReference`, a reference the adapter cannot resolve keeps
 * returning the redacted view to signed-in users. That fallback is
 * deprecated: it is reported through `unauthorizedFallback` so the caller can
 * warn, and the next major version removes it.
 */
export const resolveReferenceAccess = async (
  input: ResolveReferenceAccessInput,
): Promise<ResolvedReferenceAccess> => {
  const { session, referenceId, authorizeReference, request } = input
  const { referenceType, access: defaultAccess } =
    await classifyReference(input)

  if (authorizeReference) {
    const access = await authorizeReference(
      {
        user: session.user,
        session: session.session,
        referenceId,
        action: 'list-subscriptions',
        referenceType,
        defaultAccess,
      },
      request,
    )
    return {
      access: normalizeReferenceAccess(access),
      referenceType,
      unauthorizedFallback: false,
    }
  }

  if (referenceType === 'unknown' && session.user.isAnonymous !== true) {
    return { access: 'redacted', referenceType, unauthorizedFallback: true }
  }

  return { access: defaultAccess, referenceType, unauthorizedFallback: false }
}
