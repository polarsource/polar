import type { AuthContext, BetterAuthPlugin } from 'better-auth'
import type { OrganizationOptions } from 'better-auth/plugins/organization'
import type {
  BetterAuthRoleMappingInput,
  BetterAuthRoleMappingOptions,
  PolarMemberRole,
} from './types'

type BetterAuthOrganizationPlugin = BetterAuthPlugin & {
  id: 'organization'
  options: OrganizationOptions
}

export const DEFAULT_BETTER_AUTH_CREATOR_ROLE = 'owner'
const DEFAULT_BILLING_MANAGER_ROLES = ['admin'] as const

export const getBetterAuthCreatorRole = (
  authContext: Pick<AuthContext, 'getPlugin'>,
): string =>
  authContext.getPlugin<BetterAuthOrganizationPlugin>('organization')?.options
    .creatorRole ?? DEFAULT_BETTER_AUTH_CREATOR_ROLE

/**
 * Parse Better Auth's comma-separated member role representation.
 *
 * Role names remain case-sensitive because Better Auth custom roles are opaque
 * application identifiers.
 */
export const parseBetterAuthRoles = (role: string): Set<string> =>
  new Set(
    role
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  )

export const hasBetterAuthCreatorRole = (
  role: string,
  creatorRole = DEFAULT_BETTER_AUTH_CREATOR_ROLE,
): boolean => parseBetterAuthRoles(role).has(creatorRole)

/**
 * Map Better Auth organization roles to Polar's fixed member roles.
 *
 * Only the member selected as Polar's canonical owner can become `owner`.
 * Additional Better Auth owners intentionally become billing managers because
 * Polar allows exactly one owner per customer.
 */
export const mapBetterAuthRoleToPolar = (
  input: BetterAuthRoleMappingInput,
  options: BetterAuthRoleMappingOptions = {},
): PolarMemberRole => {
  if (input.isCanonicalOwner) {
    return 'owner'
  }

  const roles = parseBetterAuthRoles(input.role)
  const creatorRole = options.creatorRole ?? DEFAULT_BETTER_AUTH_CREATOR_ROLE
  const billingManagerRoles =
    options.billingManagerRoles ?? DEFAULT_BILLING_MANAGER_ROLES

  if (
    roles.has(creatorRole) ||
    billingManagerRoles.some((role) => roles.has(role))
  ) {
    return 'billing_manager'
  }

  return 'member'
}
