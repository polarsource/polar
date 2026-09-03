import type { AuthContext, BetterAuthPlugin } from 'better-auth'
import type { OrganizationOptions } from 'better-auth/plugins/organization'
import type { PolarOptions } from '../types'
import {
  BetterAuthOrganizationStateError,
  removeOrganizationMemberMirror,
} from './lifecycle'
import { DEFAULT_BETTER_AUTH_CREATOR_ROLE } from './roles'
import { getOrganizationRoster, synchronizeOrganizationSeats } from './seats'
import {
  ensureMemberMirror,
  ensureTeamCustomer,
  isTeamCustomerSynchronized,
  updateMemberRoleMirror,
  updateTeamCustomer,
} from './sync'
import type { PolarOrganizationRoleSyncOptions } from './types'

type BetterAuthOrganizationPlugin = BetterAuthPlugin & {
  id: 'organization'
  options: OrganizationOptions
}

type OrganizationHooks = NonNullable<OrganizationOptions['organizationHooks']>
type AfterCreateOrganizationData = Parameters<
  NonNullable<OrganizationHooks['afterCreateOrganization']>
>[0]
type AfterUpdateOrganizationData = Parameters<
  NonNullable<OrganizationHooks['afterUpdateOrganization']>
>[0]
type AfterAddMemberData = Parameters<
  NonNullable<OrganizationHooks['afterAddMember']>
>[0]
type AfterAcceptInvitationData = Parameters<
  NonNullable<OrganizationHooks['afterAcceptInvitation']>
>[0]
type AfterUpdateMemberRoleData = Parameters<
  NonNullable<OrganizationHooks['afterUpdateMemberRole']>
>[0]
type AfterRemoveMemberData = Parameters<
  NonNullable<OrganizationHooks['afterRemoveMember']>
>[0]

/**
 * Compose Polar's customer, roster, and single-owner synchronization into
 * Better Auth's organization lifecycle hooks. Application after-hooks run
 * first; Polar synchronization runs only after they succeed.
 */
export const installOrganizationHooks = (
  ctx: AuthContext,
  options: PolarOptions,
) => {
  const organizationOptions = options.experimental_organizationSync
  if (!organizationOptions?.enabled) {
    return
  }

  const organizationPlugin =
    ctx.getPlugin<BetterAuthOrganizationPlugin>('organization')

  if (!organizationPlugin) {
    throw new Error(
      "Polar organization support requires Better Auth's organization plugin",
    )
  }

  const client = options.client
  const betterAuthOrganizationOptions = organizationPlugin.options

  const existingHooks = betterAuthOrganizationOptions.organizationHooks ?? {}

  const roleSyncOptions: PolarOrganizationRoleSyncOptions = {
    creatorRole:
      betterAuthOrganizationOptions.creatorRole ??
      DEFAULT_BETTER_AUTH_CREATOR_ROLE,
    mapBetterAuthRoleToPolarRole:
      organizationOptions.mapBetterAuthRoleToPolarRole,
  }

  const syncCreatedOrganization = async (data: AfterCreateOrganizationData) => {
    await ensureTeamCustomer(client, organizationOptions, {
      organization: data.organization,
      owner: data.user,
    })
  }

  const syncUpdatedOrganization = async (data: AfterUpdateOrganizationData) => {
    const updatedOrganization = data.organization
    if (!updatedOrganization) {
      throw new BetterAuthOrganizationStateError(
        `Better Auth adapter returned no updated organization for "${data.member.organizationId}"`,
      )
    }
    if (!(await isTeamCustomerSynchronized(client, updatedOrganization.id))) {
      return
    }

    await updateTeamCustomer(client, updatedOrganization)
    await synchronizeOrganizationSeats({
      authContext: ctx,
      client,
      organizationId: updatedOrganization.id,
      organizationOptions,
      betterAuthOrganizationOptions,
    })
  }

  const syncMember = async (
    data: AfterAddMemberData | AfterAcceptInvitationData,
  ) => {
    if (!(await isTeamCustomerSynchronized(client, data.organization.id))) {
      return
    }

    await ensureMemberMirror(client, roleSyncOptions, {
      organizationId: data.organization.id,
      user: data.user,
      betterAuthRole: data.member.role,
    })
    await synchronizeOrganizationSeats({
      authContext: ctx,
      client,
      organizationId: data.organization.id,
      organizationOptions,
      betterAuthOrganizationOptions,
    })
  }

  const syncAddedMember = async (data: AfterAddMemberData) => {
    const members = await getOrganizationRoster(
      ctx,
      betterAuthOrganizationOptions,
      data.organization.id,
    )
    const isInitialCreator =
      members.length === 1 && members[0]?.userId === data.member.userId

    // afterCreateOrganization mirrors the creator as the Polar team owner.
    if (isInitialCreator) return

    await syncMember(data)
  }

  const syncUpdatedMemberRole = async (data: AfterUpdateMemberRoleData) => {
    if (!(await isTeamCustomerSynchronized(client, data.organization.id))) {
      return
    }
    const members = await getOrganizationRoster(
      ctx,
      betterAuthOrganizationOptions,
      data.organization.id,
    )
    await updateMemberRoleMirror(client, roleSyncOptions, {
      organizationId: data.organization.id,
      user: data.user,
      betterAuthRole: data.member.role,
      members,
    })
    await synchronizeOrganizationSeats({
      authContext: ctx,
      client,
      organizationId: data.organization.id,
      organizationOptions,
      betterAuthOrganizationOptions,
    })
  }

  const syncRemovedMember = async (data: AfterRemoveMemberData) => {
    await removeOrganizationMemberMirror({
      authContext: ctx,
      client,
      organizationId: data.organization.id,
      userId: data.member.userId,
      role: data.member.role,
      roleOptions: roleSyncOptions,
      organizationOptions,
      betterAuthOrganizationOptions,
    })
  }

  betterAuthOrganizationOptions.organizationHooks = {
    ...existingHooks,
    afterCreateOrganization: async (data: AfterCreateOrganizationData) => {
      await existingHooks.afterCreateOrganization?.(data)
      await syncCreatedOrganization(data)
    },
    afterUpdateOrganization: async (data: AfterUpdateOrganizationData) => {
      await existingHooks.afterUpdateOrganization?.(data)
      await syncUpdatedOrganization(data)
    },
    afterAddMember: async (data: AfterAddMemberData) => {
      await existingHooks.afterAddMember?.(data)
      await syncAddedMember(data)
    },
    afterAcceptInvitation: async (data: AfterAcceptInvitationData) => {
      await existingHooks.afterAcceptInvitation?.(data)
      await syncMember(data)
    },
    afterUpdateMemberRole: async (data: AfterUpdateMemberRoleData) => {
      await existingHooks.afterUpdateMemberRole?.(data)
      await syncUpdatedMemberRole(data)
    },
    afterRemoveMember: async (data: AfterRemoveMemberData) => {
      await existingHooks.afterRemoveMember?.(data)
      await syncRemovedMember(data)
    },
  }
}
