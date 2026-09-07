import type { AuthContext } from 'better-auth'
import { organization as betterAuthOrganization } from 'better-auth/plugins'
import type {
  Invitation,
  Member,
  Organization,
  OrganizationOptions,
} from 'better-auth/plugins/organization'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { errors, type models } from '@polar-sh/sdk/2026-04'
import { installOrganizationHooks } from '../../organization/hooks'
import { createTestPolarOptions } from '../utils/helpers'
import { createMockPolarClient, createMockUser } from '../utils/mocks'

type PolarMember = models.Member
const { ResourceNotFound } = errors

const organization: Organization = {
  id: 'organization-123',
  name: 'Acme',
  slug: 'acme',
  logo: null,
  createdAt: new Date(),
}

const owner = createMockUser({
  id: 'user-123',
  email: 'owner@example.com',
  name: 'Owner',
})

const member: Member = {
  id: 'member-123',
  organizationId: organization.id,
  userId: owner.id,
  role: 'owner',
  createdAt: new Date(),
}

const teamCustomer: models.CustomerTeam = {
  id: 'customer-123',
  created_at: new Date().toISOString(),
  modified_at: null,
  metadata: {},
  external_id: organization.id,
  email: null,
  email_verified: false,
  type: 'team' as const,
  name: organization.name,
  billing_name: null,
  billing_address: null,
  tax_id: null,
  organization_id: 'polar-organization-123',
  deleted_at: null,
  first_user_event_at: null,
  avatar_url: null,
}

const polarOwner: PolarMember = {
  id: 'polar-member-123',
  created_at: new Date().toISOString(),
  modified_at: null,
  customer_id: teamCustomer.id,
  email: owner.email,
  name: owner.name,
  external_id: owner.id,
  role: 'owner' as const,
}

const memberPage = (items: PolarMember[]) => ({
  items,
  pagination: { total_count: items.length, max_page: 1 },
})

const notFound = () =>
  new ResourceNotFound(404, {
    error: 'ResourceNotFound',
    detail: 'Customer not found',
  })

const createContext = (
  organizationOptions: OrganizationOptions | null,
  roster: Array<{ member: Member; user: ReturnType<typeof createMockUser> }> = [
    { member, user: owner },
  ],
) => {
  const logger = {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }
  const organizationPlugin = organizationOptions
    ? {
        id: 'organization',
        options: organizationOptions,
      }
    : null
  const getPlugin = vi.fn((id: string) =>
    id === 'organization' ? organizationPlugin : null,
  )
  const adapter = {
    findMany: vi.fn(async ({ model }: { model: string }) => {
      if (model === 'member') return roster.map((entry) => entry.member)
      if (model === 'user') return roster.map((entry) => entry.user)
      return []
    }),
    count: vi.fn(async ({ model }: { model: string }) =>
      model === 'member' ? roster.length : 0,
    ),
  }

  return {
    ctx: { getPlugin, logger, adapter } as unknown as AuthContext,
    getPlugin,
    logger,
    organizationPlugin,
  }
}

describe('organization hook installation', () => {
  let client: ReturnType<typeof createMockPolarClient>

  beforeEach(() => {
    client = createMockPolarClient()
    vi.clearAllMocks()
  })

  it('does nothing when organization support is disabled', () => {
    const context = createContext(null)

    installOrganizationHooks(
      context.ctx,
      createTestPolarOptions({
        client,
        experimental_organizationSync: { enabled: false },
      }),
    )

    expect(context.getPlugin).not.toHaveBeenCalled()
  })

  it("composes the application hook on Better Auth's organization plugin", async () => {
    const applicationHook = vi.fn()
    const betterAuthPlugin = betterAuthOrganization({
      organizationHooks: { afterCreateOrganization: applicationHook },
    })
    const context = createContext(betterAuthPlugin.options)
    vi.mocked(client.customers.getExternal)
      .mockRejectedValueOnce(notFound())
      .mockResolvedValue(teamCustomer)
    vi.mocked(client.customers.create).mockResolvedValue(teamCustomer)
    vi.mocked(client.customers.members.listExternal).mockResolvedValue(
      memberPage([polarOwner]),
    )
    vi.mocked(client.customers.members.getExternal).mockResolvedValue(
      polarOwner,
    )

    installOrganizationHooks(
      context.ctx,
      createTestPolarOptions({
        client,
        experimental_organizationSync: { enabled: true },
      }),
    )
    await betterAuthPlugin.options.organizationHooks?.afterCreateOrganization?.(
      {
        organization,
        member,
        user: owner,
      },
    )

    expect(applicationHook).toHaveBeenCalledOnce()
    expect(client.customers.create).toHaveBeenCalledOnce()
    expect(client.customers.members.listExternal).not.toHaveBeenCalled()
    const applicationCallOrder = applicationHook.mock.invocationCallOrder[0]
    const polarCallOrder = vi.mocked(client.customers.create).mock
      .invocationCallOrder[0]
    expect(applicationCallOrder).toBeDefined()
    expect(polarCallOrder).toBeDefined()
    expect(applicationCallOrder).toBeLessThan(polarCallOrder ?? 0)
  })

  it('does not synchronize when the application hook fails', async () => {
    const applicationError = new Error('Application hook failed')
    const context = createContext({
      organizationHooks: {
        afterCreateOrganization: vi.fn().mockRejectedValue(applicationError),
      },
    })

    installOrganizationHooks(
      context.ctx,
      createTestPolarOptions({
        client,
        experimental_organizationSync: { enabled: true },
      }),
    )

    await expect(
      context.organizationPlugin?.options.organizationHooks?.afterCreateOrganization?.(
        { organization, member, user: owner },
      ),
    ).rejects.toBe(applicationError)
    expect(client.customers.getExternal).not.toHaveBeenCalled()
  })

  it('updates the team customer after an organization rename', async () => {
    const applicationHook = vi.fn()
    const context = createContext({
      organizationHooks: { afterUpdateOrganization: applicationHook },
    })
    vi.mocked(client.customers.getExternal).mockResolvedValue(teamCustomer)
    vi.mocked(client.customers.updateExternal).mockResolvedValue({
      ...teamCustomer,
      name: 'New name',
    })

    installOrganizationHooks(
      context.ctx,
      createTestPolarOptions({
        client,
        experimental_organizationSync: { enabled: true },
      }),
    )
    await context.organizationPlugin?.options.organizationHooks?.afterUpdateOrganization?.(
      {
        organization: { ...organization, name: 'New name' },
        member,
        user: owner,
      },
    )

    expect(applicationHook).toHaveBeenCalledOnce()
    expect(client.customers.updateExternal).toHaveBeenCalledWith(
      organization.id,
      { name: 'New name' },
    )
  })

  it('fails when an adapter returns no updated organization', async () => {
    const context = createContext({})

    installOrganizationHooks(
      context.ctx,
      createTestPolarOptions({
        client,
        experimental_organizationSync: { enabled: true },
      }),
    )

    await expect(
      context.organizationPlugin?.options.organizationHooks?.afterUpdateOrganization?.(
        { organization: null, member, user: owner },
      ),
    ).rejects.toThrow(
      `Better Auth adapter returned no updated organization for "${organization.id}"`,
    )
    expect(client.customers.updateExternal).not.toHaveBeenCalled()
  })

  it('skips creator mirroring because organization creation mirrors the owner', async () => {
    const applicationHook = vi.fn()
    const context = createContext({
      organizationHooks: { afterAddMember: applicationHook },
    })
    vi.mocked(client.customers.getExternal).mockRejectedValue(notFound())

    installOrganizationHooks(
      context.ctx,
      createTestPolarOptions({
        client,
        experimental_organizationSync: { enabled: true },
      }),
    )
    await context.organizationPlugin?.options.organizationHooks?.afterAddMember?.(
      { organization, member, user: owner },
    )

    expect(applicationHook).toHaveBeenCalledOnce()
    expect(client.customers.getExternal).not.toHaveBeenCalled()
    expect(client.customers.members.createExternal).not.toHaveBeenCalled()
    expect(client.customers.members.listExternal).not.toHaveBeenCalled()
  })

  it('uses one idempotent roster path for direct additions and invitations', async () => {
    const invitedUser = createMockUser({
      id: 'invited-user',
      email: 'invited@example.com',
      name: 'Invited',
    })
    const invitedMember: Member = {
      id: 'invited-membership',
      organizationId: organization.id,
      userId: invitedUser.id,
      role: 'admin',
      createdAt: new Date(),
    }
    const afterAddMember = vi.fn()
    const afterAcceptInvitation = vi.fn()
    const context = createContext(
      {
        organizationHooks: { afterAddMember, afterAcceptInvitation },
      },
      [
        { member, user: owner },
        { member: invitedMember, user: invitedUser },
      ],
    )
    const invitedPolarMember = {
      ...polarOwner,
      id: 'polar-invited-member',
      external_id: invitedUser.id,
      email: invitedUser.email,
      name: invitedUser.name,
      role: 'billing_manager' as const,
    }
    let invitedExists = false
    vi.mocked(client.customers.getExternal).mockResolvedValue(teamCustomer)
    vi.mocked(client.customers.members.listExternal).mockResolvedValue(
      memberPage([polarOwner]),
    )
    vi.mocked(client.customers.members.getExternal).mockImplementation(
      async (_organizationId, memberExternalId) => {
        if (memberExternalId === owner.id) return polarOwner
        if (invitedExists) return invitedPolarMember
        throw notFound()
      },
    )
    vi.mocked(client.customers.members.createExternal).mockImplementation(
      async () => {
        invitedExists = true
        return invitedPolarMember
      },
    )

    installOrganizationHooks(
      context.ctx,
      createTestPolarOptions({
        client,
        experimental_organizationSync: { enabled: true },
      }),
    )
    await context.organizationPlugin?.options.organizationHooks?.afterAddMember?.(
      { organization, member: invitedMember, user: invitedUser },
    )
    const invitation: Invitation = {
      id: 'invitation-123',
      organizationId: organization.id,
      email: invitedUser.email,
      role: invitedMember.role,
      status: 'accepted',
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      inviterId: owner.id,
    }
    await context.organizationPlugin?.options.organizationHooks?.afterAcceptInvitation?.(
      {
        organization,
        member: invitedMember,
        user: invitedUser,
        invitation,
      },
    )

    expect(afterAddMember).toHaveBeenCalledOnce()
    expect(afterAcceptInvitation).toHaveBeenCalledOnce()
    expect(client.customers.members.createExternal).toHaveBeenCalledOnce()
    expect(client.customers.members.createExternal).toHaveBeenCalledWith(
      organization.id,
      {
        external_id: invitedUser.id,
        email: invitedUser.email,
        name: invitedUser.name,
        role: 'billing_manager',
      },
    )
  })

  it('runs the application role-update hook before Polar synchronization', async () => {
    const afterUpdateMemberRole = vi.fn()
    const context = createContext({
      organizationHooks: { afterUpdateMemberRole },
    })
    vi.mocked(client.customers.getExternal).mockResolvedValue(teamCustomer)
    vi.mocked(client.customers.members.listExternal).mockResolvedValue(
      memberPage([polarOwner]),
    )

    installOrganizationHooks(
      context.ctx,
      createTestPolarOptions({
        client,
        experimental_organizationSync: { enabled: true },
      }),
    )
    await context.organizationPlugin?.options.organizationHooks?.afterUpdateMemberRole?.(
      {
        organization,
        member,
        previousRole: 'admin',
        user: owner,
      },
    )

    expect(afterUpdateMemberRole).toHaveBeenCalledOnce()
    expect(afterUpdateMemberRole.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(client.customers.getExternal).mock.invocationCallOrder[0] ?? 0,
    )
  })

  it('runs the application removal hook before deleting the Polar member', async () => {
    const afterRemoveMember = vi.fn()
    const departingUser = createMockUser({ id: 'departing-user' })
    const departingMember: Member = {
      id: 'departing-membership',
      organizationId: organization.id,
      userId: departingUser.id,
      role: 'member',
      createdAt: new Date(),
    }
    const context = createContext({
      organizationHooks: { afterRemoveMember },
    })
    vi.mocked(client.customers.getExternal).mockResolvedValue(teamCustomer)
    vi.mocked(client.customers.members.listExternal).mockResolvedValue(
      memberPage([polarOwner]),
    )
    vi.mocked(client.customers.members.deleteExternal).mockResolvedValue(
      undefined,
    )

    installOrganizationHooks(
      context.ctx,
      createTestPolarOptions({
        client,
        experimental_organizationSync: { enabled: true },
      }),
    )
    await context.organizationPlugin?.options.organizationHooks?.afterRemoveMember?.(
      {
        organization,
        member: departingMember,
        user: departingUser,
      },
    )

    expect(afterRemoveMember).toHaveBeenCalledOnce()
    expect(client.customers.members.deleteExternal).toHaveBeenCalledWith(
      organization.id,
      departingUser.id,
    )
    expect(afterRemoveMember.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(client.customers.members.deleteExternal).mock
        .invocationCallOrder[0] ?? 0,
    )
  })
})
