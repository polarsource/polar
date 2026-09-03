import type { AuthContext, User } from 'better-auth'
import { APIError } from 'better-auth/api'
import type { AnonymousSession } from 'better-auth/plugins/anonymous'
import type { Member } from 'better-auth/plugins/organization'
import {
  hasBetterAuthCreatorRole,
  mapBetterAuthRoleToPolar,
  parseBetterAuthRoles,
} from './organization/roles'
import type { PolarOrganizationRoleSyncOptions } from './organization/types'

export type BillingAuthorization = 'member' | 'billing'

export type BillingPrincipal =
  | {
      kind: 'individual'
      /** Undefined preserves endpoints that allow checkout without a session. */
      externalCustomerId: string | undefined
    }
  | {
      kind: 'team'
      externalCustomerId: string
      externalMemberId: string
    }

export interface BillingPrincipalSession {
  user: User & Partial<Pick<AnonymousSession['user'], 'isAnonymous'>>
}

export interface ResolveBillingPrincipalInput {
  /** Better Auth context whose adapter understands logical plugin model names. */
  context: {
    adapter: Pick<AuthContext['adapter'], 'findOne'>
  }
  /** The endpoint's resolved session, or null when unauthenticated. */
  session: BillingPrincipalSession | null
  /** Explicit organization selection. Active organization is never inferred. */
  organizationId?: string | undefined
  /** Reject team billing when the root Polar integration explicitly disabled it. */
  organizationEnabled?: boolean | undefined
  /** Organization permission required by the endpoint. @default "member" */
  authorization?: BillingAuthorization | undefined
  /** Better Auth-to-Polar role mapping used by billing authorization. */
  roleMapping?: PolarOrganizationRoleSyncOptions | undefined
}

const isBillingRole = async (
  role: string,
  organizationId: string,
  user: BillingPrincipalSession['user'],
  roleMapping: PolarOrganizationRoleSyncOptions | undefined,
): Promise<boolean> => {
  const creatorRole = roleMapping?.creatorRole

  // Both canonical and additional Better Auth owners are billing-capable.
  // Canonical ownership is irrelevant to this local authorization check.
  if (hasBetterAuthCreatorRole(role, creatorRole)) {
    return true
  }

  if (roleMapping?.mapBetterAuthRoleToPolarRole) {
    const polarRole = await roleMapping.mapBetterAuthRoleToPolarRole({
      role,
      roles: parseBetterAuthRoles(role),
      organizationId,
      user,
    })
    return polarRole === 'billing_manager'
  }

  return (
    mapBetterAuthRoleToPolar(
      {
        role,
        isCanonicalOwner: false,
      },
      roleMapping,
    ) !== 'member'
  )
}

/**
 * Resolve the Polar billing identity and authorize explicit organization access.
 *
 * This function performs local Better Auth authorization only. It deliberately
 * does not infer an active organization or make Polar repair/API calls.
 */
export const resolveBillingPrincipal = async ({
  context,
  session,
  organizationId,
  organizationEnabled,
  authorization = 'member',
  roleMapping,
}: ResolveBillingPrincipalInput): Promise<BillingPrincipal> => {
  if (organizationId === undefined) {
    return {
      kind: 'individual',
      externalCustomerId: session?.user.id,
    }
  }

  if (organizationEnabled !== true) {
    throw new APIError('BAD_REQUEST', {
      message: 'Polar organization support is not enabled',
    })
  }

  if (!session?.user.id) {
    throw new APIError('UNAUTHORIZED', {
      message: 'Authentication is required to access organization billing',
    })
  }

  if (session.user.isAnonymous === true) {
    throw new APIError('UNAUTHORIZED', {
      message: 'Anonymous users cannot access organization billing',
    })
  }

  const membership = await context.adapter.findOne<Member>({
    model: 'member',
    where: [
      {
        field: 'userId',
        value: session.user.id,
      },
      {
        field: 'organizationId',
        value: organizationId,
      },
    ],
  })

  if (!membership) {
    throw new APIError('FORBIDDEN', {
      message: 'User is not a member of the requested organization',
    })
  }

  if (
    authorization === 'billing' &&
    !(await isBillingRole(
      membership.role,
      organizationId,
      session.user,
      roleMapping,
    ))
  ) {
    throw new APIError('FORBIDDEN', {
      message: 'Organization billing access requires a billing role',
    })
  }

  return {
    kind: 'team',
    externalCustomerId: organizationId,
    externalMemberId: session.user.id,
  }
}
