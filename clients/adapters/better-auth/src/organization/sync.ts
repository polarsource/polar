import {
  createExternalMembers,
  deleteExternalMembers,
  updateExternalMembers,
  listExternalMembers,
  getExternalMembers,
} from '@polar-sh/sdk/2026-04/services/customers/members'
import {
  updateExternalCustomers,
  getExternalCustomers,
  createCustomers,
} from '@polar-sh/sdk/2026-04/services/customers'
import { errors, type models, type PolarCore } from '@polar-sh/sdk/2026-04'
import type { Organization } from 'better-auth/plugins/organization'
import {
  DEFAULT_BETTER_AUTH_CREATOR_ROLE,
  hasBetterAuthCreatorRole,
  mapBetterAuthRoleToPolar,
  parseBetterAuthRoles,
} from './roles'
import type {
  BetterAuthOrganizationMemberMirror,
  BetterAuthOrganizationUser,
  PolarMemberRole,
  PolarNonOwnerMemberRole,
  PolarOrganizationOptions,
  PolarOrganizationRoleSyncOptions,
} from './types'

type PolarOrganizationCustomerData = Parameters<
  NonNullable<PolarOrganizationOptions['getTeamCustomerCreateParams']>
>[0]

export class PolarOrganizationCustomerTypeError extends Error {
  constructor(externalCustomerId: string) {
    super(
      `Polar customer with external ID "${externalCustomerId}" is not a team customer`,
    )
    this.name = 'PolarOrganizationCustomerTypeError'
  }
}

export class PolarOrganizationTeamCustomerNotFoundError extends Error {
  constructor(organizationId: string) {
    super(
      `Polar team customer with external ID "${organizationId}" was not found`,
    )
    this.name = 'PolarOrganizationTeamCustomerNotFoundError'
  }
}

export class PolarOrganizationOwnerInvariantError extends Error {
  constructor(organizationId: string, detail: string) {
    super(
      `Cannot synchronize Polar owner for organization "${organizationId}": ${detail}`,
    )
    this.name = 'PolarOrganizationOwnerInvariantError'
  }
}

export class PolarOrganizationMemberRoleMappingError extends Error {
  constructor(role: unknown) {
    super(
      `Polar organization member role mapper returned ${JSON.stringify(role)}; expected "member" or "billing_manager"`,
    )
    this.name = 'PolarOrganizationMemberRoleMappingError'
  }
}

const assertTeamCustomer = (
  customer: models.Customer,
  externalCustomerId: string,
) => {
  if (customer.type !== 'team') {
    throw new PolarOrganizationCustomerTypeError(externalCustomerId)
  }
}

const isExternalIdConflict = (
  error: unknown,
  externalCustomerId: string,
): boolean =>
  error instanceof errors.HTTPValidationError &&
  error.statusCode === 422 &&
  Boolean(
    error.error.detail?.some(
      (detail) =>
        detail.type === 'value_error' &&
        detail.loc.length === 2 &&
        detail.loc[0] === 'body' &&
        detail.loc[1] === 'external_id' &&
        detail.input === externalCustomerId,
    ),
  )

const findTeamCustomer = async (
  client: PolarCore,
  externalCustomerId: string,
): Promise<models.Customer | null> => {
  try {
    const customer = await getExternalCustomers(client)(externalCustomerId)
    assertTeamCustomer(customer, externalCustomerId)
    return customer
  } catch (error) {
    if (error instanceof errors.ResourceNotFound) {
      return null
    }
    throw error
  }
}

export const isTeamCustomerSynchronized = async (
  client: PolarCore,
  externalCustomerId: string,
): Promise<boolean> =>
  (await findTeamCustomer(client, externalCustomerId)) !== null

export const ensureTeamCustomer = async (
  client: PolarCore,
  organizationOptions: PolarOrganizationOptions,
  data: PolarOrganizationCustomerData,
) => {
  const existingCustomer = await findTeamCustomer(client, data.organization.id)

  if (existingCustomer) {
    return
  }

  const customParams = organizationOptions.getTeamCustomerCreateParams
    ? await organizationOptions.getTeamCustomerCreateParams(data)
    : {}

  try {
    await createCustomers(client)({
      ...customParams,
      external_id: data.organization.id,
      name: data.organization.name,
      owner: {
        external_id: data.owner.id,
        email: data.owner.email,
        name: data.owner.name,
      },
      type: 'team',
    })
  } catch (error) {
    if (!isExternalIdConflict(error, data.organization.id)) {
      throw error
    }

    const racedCustomer = await findTeamCustomer(client, data.organization.id)
    if (!racedCustomer) {
      throw error
    }
  }
}

export const updateTeamCustomer = async (
  client: PolarCore,
  organization: Organization & Record<string, unknown>,
) => {
  const updatedCustomer = await updateExternalCustomers(client)(
    organization.id,
    { name: organization.name },
  )
  assertTeamCustomer(updatedCustomer, organization.id)
}

const findMember = async (
  client: PolarCore,
  organizationId: string,
  externalMemberId: string,
): Promise<models.Member | null> => {
  try {
    return await getExternalMembers(client)(organizationId, externalMemberId)
  } catch (error) {
    if (error instanceof errors.ResourceNotFound) {
      return null
    }
    throw error
  }
}

type MemberRoleData = Pick<
  BetterAuthOrganizationMemberMirror,
  'role' | 'user' | 'userId'
>

const ensureMemberRecord = async (
  client: PolarCore,
  organizationId: string,
  member: MemberRoleData,
  role: PolarNonOwnerMemberRole,
): Promise<void> => {
  const existingMember = await findMember(client, organizationId, member.userId)

  if (existingMember) {
    return
  }

  await createExternalMembers(client)(organizationId, {
    external_id: member.userId,
    email: member.user.email,
    name: member.user.name,
    role,
  })
}

const resolveNonOwnerRole = async (
  options: PolarOrganizationRoleSyncOptions,
  organizationId: string,
  member: MemberRoleData,
): Promise<PolarNonOwnerMemberRole> => {
  if (!options.mapBetterAuthRoleToPolarRole) {
    const role = mapBetterAuthRoleToPolar(
      { role: member.role, isCanonicalOwner: false },
      options,
    )
    if (role === 'owner') {
      throw new PolarOrganizationMemberRoleMappingError(role)
    }
    return role
  }

  const role = await options.mapBetterAuthRoleToPolarRole({
    role: member.role,
    roles: parseBetterAuthRoles(member.role),
    organizationId,
    user: member.user,
  })
  if (role !== 'member' && role !== 'billing_manager') {
    throw new PolarOrganizationMemberRoleMappingError(role)
  }
  return role
}

export const byEarliestMembership = (
  left: Pick<BetterAuthOrganizationMemberMirror, 'id' | 'createdAt'>,
  right: Pick<BetterAuthOrganizationMemberMirror, 'id' | 'createdAt'>,
): number => {
  const createdAtDifference =
    left.createdAt.getTime() - right.createdAt.getTime()
  if (createdAtDifference !== 0) return createdAtDifference
  if (left.id < right.id) return -1
  if (left.id > right.id) return 1
  return 0
}

const updateMemberRole = async (
  client: PolarCore,
  organizationId: string,
  externalMemberId: string,
  role: PolarMemberRole,
) => {
  await updateExternalMembers(client)(organizationId, externalMemberId, {
    role,
  })
}

const getCurrentPolarOwner = async (
  client: PolarCore,
  organizationId: string,
): Promise<models.Member> => {
  const customer = await findTeamCustomer(client, organizationId)
  if (!customer) {
    throw new PolarOrganizationTeamCustomerNotFoundError(organizationId)
  }

  const ownerPage = await listExternalMembers(client)(organizationId, {
    role: 'owner',
    limit: 100,
  })

  const polarOwners = ownerPage.items
  if (polarOwners.length !== 1) {
    throw new PolarOrganizationOwnerInvariantError(
      organizationId,
      `Polar returned ${polarOwners.length} owners`,
    )
  }

  const currentOwner = polarOwners[0]
  if (!currentOwner?.external_id) {
    throw new PolarOrganizationOwnerInvariantError(
      organizationId,
      'the current Polar owner has no external ID',
    )
  }
  return currentOwner
}

/** Transfer ownership only when the current Polar owner is no longer a Better Auth owner. */
const syncOwnerTransfer = async (
  client: PolarCore,
  options: PolarOrganizationRoleSyncOptions,
  data: {
    organizationId: string
    members: readonly BetterAuthOrganizationMemberMirror[]
  },
) => {
  const creatorRole = options.creatorRole ?? DEFAULT_BETTER_AUTH_CREATOR_ROLE
  const ownerCandidates = data.members
    .filter((member) => hasBetterAuthCreatorRole(member.role, creatorRole))
    .sort(byEarliestMembership)
  const fallbackOwner = ownerCandidates[0]
  if (!fallbackOwner) {
    throw new PolarOrganizationOwnerInvariantError(
      data.organizationId,
      `Better Auth has no member with creator role "${creatorRole}"`,
    )
  }

  const currentOwner = await getCurrentPolarOwner(client, data.organizationId)

  const retainedOwner = ownerCandidates.find(
    (candidate) => candidate.userId === currentOwner.external_id,
  )

  if (retainedOwner) {
    return { canonicalOwner: retainedOwner, currentOwner, transferred: false }
  }

  const successor = await findMember(
    client,
    data.organizationId,
    fallbackOwner.userId,
  )
  if (!successor) {
    throw new PolarOrganizationOwnerInvariantError(
      data.organizationId,
      `successor "${fallbackOwner.userId}" is not a Polar member`,
    )
  }
  await updateMemberRole(
    client,
    data.organizationId,
    fallbackOwner.userId,
    'owner',
  )

  // Polar automatically demotes the previous owner to billing manager. If the
  // previous owner remains in Better Auth and maps to `member`, apply that
  // explicit role as part of this transfer.
  const previousOwner = data.members.find(
    (member) => member.userId === currentOwner.external_id,
  )

  if (previousOwner) {
    const previousOwnerRole = await resolveNonOwnerRole(
      options,
      data.organizationId,
      previousOwner,
    )

    if (previousOwnerRole !== 'billing_manager') {
      await updateMemberRole(
        client,
        data.organizationId,
        previousOwner.userId,
        previousOwnerRole,
      )
    }
  }

  return { canonicalOwner: fallbackOwner, currentOwner, transferred: true }
}

export const ensureMemberMirror = async (
  client: PolarCore,
  options: PolarOrganizationRoleSyncOptions,
  data: {
    organizationId: string
    user: BetterAuthOrganizationUser
    betterAuthRole: string
  },
) => {
  const customer = await findTeamCustomer(client, data.organizationId)
  if (!customer) {
    throw new PolarOrganizationTeamCustomerNotFoundError(data.organizationId)
  }

  const member = {
    role: data.betterAuthRole,
    userId: data.user.id,
    user: data.user,
  }
  const role = await resolveNonOwnerRole(options, data.organizationId, member)
  await ensureMemberRecord(client, data.organizationId, member, role)
}

export const updateMemberRoleMirror = async (
  client: PolarCore,
  options: PolarOrganizationRoleSyncOptions,
  data: {
    organizationId: string
    user: BetterAuthOrganizationUser
    betterAuthRole: string
    members: readonly BetterAuthOrganizationMemberMirror[]
  },
) => {
  const ownership = await syncOwnerTransfer(client, options, {
    organizationId: data.organizationId,
    members: data.members,
  })

  if (
    data.user.id === ownership.canonicalOwner.userId ||
    (ownership.transferred &&
      data.user.id === ownership.currentOwner.external_id)
  ) {
    return
  }

  const member = {
    role: data.betterAuthRole,
    userId: data.user.id,
    user: data.user,
  }

  const role = await resolveNonOwnerRole(options, data.organizationId, member)

  await updateMemberRole(client, data.organizationId, data.user.id, role)
}

export const updateMemberMirror = async (
  client: PolarCore,
  data: {
    organizationId: string
    user: BetterAuthOrganizationUser
  },
) => {
  await updateExternalMembers(client)(data.organizationId, data.user.id, {
    email: data.user.email,
    name: data.user.name,
  })
}

export const promoteMemberMirrorToOwner = async (
  client: PolarCore,
  data: {
    organizationId: string
    externalMemberId: string
  },
) => {
  const polarSuccessor = await findMember(
    client,
    data.organizationId,
    data.externalMemberId,
  )
  if (!polarSuccessor) {
    throw new PolarOrganizationOwnerInvariantError(
      data.organizationId,
      `successor "${data.externalMemberId}" is not a Polar member`,
    )
  }
  await updateMemberRole(
    client,
    data.organizationId,
    data.externalMemberId,
    'owner',
  )
}

export const removeMemberMirror = async (
  client: PolarCore,
  data: {
    organizationId: string
    externalMemberId: string
  },
) => {
  try {
    await deleteExternalMembers(client)(
      data.organizationId,
      data.externalMemberId,
    )
  } catch (error) {
    if (error instanceof errors.ResourceNotFound) return

    throw error
  }
}
