import type { AuthContext } from 'better-auth'
import type { Member, Organization } from 'better-auth/plugins/organization'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ORGANIZATION_LEAVE_PATH,
  createOrganizationLifecycleHooks,
  removeOrganizationMemberMirror,
  synchronizeOrganizationLeave,
  synchronizeUserDeletionMemberships,
  synchronizeUserOrganizationProfiles,
} from '../../organization/lifecycle'
import {
  isTeamCustomerSynchronized,
  promoteMemberMirrorToOwner,
  removeMemberMirror,
  updateMemberMirror,
} from '../../organization/sync'
import { createTestPolarOptions } from '../utils/helpers'
import { createMockPolarClient, createMockUser } from '../utils/mocks'

vi.mock('../../organization/sync', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../organization/sync')>()
  return {
    ...actual,
    isTeamCustomerSynchronized: vi.fn(),
    promoteMemberMirrorToOwner: vi.fn(),
    removeMemberMirror: vi.fn(),
    updateMemberMirror: vi.fn(),
  }
})

const organizations: Organization[] = [
  {
    id: 'org-a',
    name: 'Organization A',
    slug: 'organization-a',
    logo: null,
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'org-b',
    name: 'Organization B',
    slug: 'organization-b',
    logo: null,
    createdAt: new Date('2024-01-02'),
  },
]

const user = createMockUser({
  id: 'user-1',
  email: 'new@example.com',
  name: 'New Name',
})
const successor = createMockUser({
  id: 'user-2',
  email: 'successor@example.com',
  name: 'Successor',
})

const memberships: Member[] = [
  {
    id: 'member-a',
    organizationId: 'org-a',
    userId: user.id,
    role: 'owner',
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'member-b',
    organizationId: 'org-b',
    userId: user.id,
    role: 'admin',
    createdAt: new Date('2024-01-02'),
  },
  {
    id: 'member-successor',
    organizationId: 'org-a',
    userId: successor.id,
    role: 'owner',
    createdAt: new Date('2024-01-03'),
  },
]

const createAuthContext = (storedMemberships = memberships) => {
  const logger = {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }
  const adapter = {
    findOne: vi.fn(async ({ model, where }) => {
      if (model !== 'organization') return null
      const id = where.find(
        (item: { field: string }) => item.field === 'id',
      )?.value
      return (
        organizations.find((organization) => organization.id === id) ?? null
      )
    }),
    findMany: vi.fn(async ({ model, where, sortBy, limit, offset = 0 }) => {
      if (model === 'member') {
        let result = storedMemberships.filter((member) =>
          where?.every(
            (clause: {
              field: keyof Member
              value: unknown
              operator?: string
            }) => {
              const value = member[clause.field]
              if (clause.operator === 'ne') return value !== clause.value
              if (clause.operator === 'contains') {
                return String(value).includes(String(clause.value))
              }
              return value === clause.value
            },
          ),
        )
        if (sortBy?.field === 'createdAt') {
          result = [...result].sort(
            (left, right) =>
              left.createdAt.getTime() - right.createdAt.getTime(),
          )
        }
        return result.slice(offset, limit ? offset + limit : undefined)
      }
      if (model === 'user') {
        const ids = where[0].value as string[]
        return [user, successor]
          .filter((candidate) => ids.includes(candidate.id))
          .slice(0, limit)
      }
      return []
    }),
  }
  const context = {
    adapter,
    logger,
    getPlugin: vi.fn().mockReturnValue({
      id: 'organization',
      options: { creatorRole: 'owner' },
    }),
  } as unknown as AuthContext
  return { context, adapter, logger }
}

describe('organization lifecycle gaps', () => {
  let client: ReturnType<typeof createMockPolarClient>
  const organizationOptions = { enabled: true }

  beforeEach(() => {
    client = createMockPolarClient()
    vi.clearAllMocks()
    vi.mocked(isTeamCustomerSynchronized).mockResolvedValue(true)
    vi.mocked(updateMemberMirror).mockResolvedValue()
    vi.mocked(promoteMemberMirrorToOwner).mockResolvedValue()
    vi.mocked(removeMemberMirror).mockResolvedValue()
  })

  it('synchronizes a profile across every organization', async () => {
    const { context } = createAuthContext()

    await synchronizeUserOrganizationProfiles(
      context,
      client,
      user,
      organizationOptions,
    )

    expect(updateMemberMirror).toHaveBeenCalledTimes(2)
    expect(vi.mocked(updateMemberMirror).mock.calls[0]?.[1]).toMatchObject({
      organizationId: 'org-a',
      user,
    })
    expect(vi.mocked(updateMemberMirror).mock.calls[1]?.[1]).toMatchObject({
      organizationId: 'org-b',
      user,
    })
  })

  it('attempts every profile synchronization before propagating a failure', async () => {
    const manyMemberships: Member[] = Array.from({ length: 8 }, (_, index) => ({
      id: `member-${index}`,
      organizationId: `org-${index}`,
      userId: user.id,
      role: 'admin',
      createdAt: new Date(2024, 0, index + 1),
    }))
    const { context } = createAuthContext(manyMemberships)
    const failure = new Error('Polar update failed')
    vi.mocked(updateMemberMirror).mockImplementation(async (_client, input) => {
      if (input.organizationId === 'org-0') throw failure
    })

    await expect(
      synchronizeUserOrganizationProfiles(
        context,
        client,
        user,
        organizationOptions,
      ),
    ).rejects.toBe(failure)
    expect(updateMemberMirror).toHaveBeenCalledTimes(8)
  })

  it('cleans up self-leave exactly once and supplies the earliest remaining owner', async () => {
    const { context } = createAuthContext()
    const options = createTestPolarOptions({
      client,
      experimental_organizationSync: { enabled: true },
    })

    await synchronizeOrganizationLeave(options, {
      context: Object.assign(context, {
        returned: memberships[0],
      }),
    })

    expect(promoteMemberMirrorToOwner).toHaveBeenCalledWith(client, {
      organizationId: 'org-a',
      externalMemberId: successor.id,
    })
    expect(removeMemberMirror).toHaveBeenCalledOnce()
    expect(vi.mocked(removeMemberMirror).mock.calls[0]?.[1]).toEqual({
      organizationId: 'org-a',
      externalMemberId: user.id,
    })
  })

  it('refuses to remove the last creator', async () => {
    const ownerMembership = memberships[0]
    if (!ownerMembership) throw new Error('Missing owner membership fixture')
    const { context } = createAuthContext([ownerMembership])

    await expect(
      removeOrganizationMemberMirror({
        authContext: context,
        client,
        organizationId: ownerMembership.organizationId,
        userId: ownerMembership.userId,
        role: ownerMembership.role,
        organizationOptions,
      }),
    ).rejects.toThrow('Better Auth has no member with creator role "owner"')
    expect(removeMemberMirror).not.toHaveBeenCalled()
  })

  it('paginates role prefilter false positives to find the earliest actual owner', async () => {
    const ownerMembership = memberships[2]
    if (!ownerMembership) throw new Error('Missing owner membership fixture')
    const falsePositives: Member[] = Array.from(
      { length: 100 },
      (_, index) => ({
        id: `member-coowner-${index}`,
        organizationId: 'org-a',
        userId: `coowner-${index}`,
        role: 'coowner',
        createdAt: new Date(
          ownerMembership.createdAt.getTime() - (100 - index) * 1_000,
        ),
      }),
    )
    const { context, adapter } = createAuthContext([
      ...falsePositives,
      ownerMembership,
    ])
    const options = createTestPolarOptions({
      client,
      experimental_organizationSync: { enabled: true },
    })

    await synchronizeOrganizationLeave(options, {
      context: Object.assign(context, {
        returned: memberships[0],
      }),
    })

    expect(promoteMemberMirrorToOwner).toHaveBeenCalledWith(client, {
      organizationId: 'org-a',
      externalMemberId: successor.id,
    })
    expect(
      vi
        .mocked(adapter.findMany)
        .mock.calls.filter(([call]) => call.model === 'member'),
    ).toHaveLength(2)
  })

  it('matches only /organization/leave, not admin removal or deletion', () => {
    const deleteCustomer = vi.fn()
    Object.assign(client.customers, { delete: deleteCustomer })
    const hooks = createOrganizationLifecycleHooks(
      createTestPolarOptions({
        client,
        experimental_organizationSync: { enabled: true },
      }),
    )
    const matcher = hooks?.after?.[0]?.matcher

    expect(matcher?.({ path: ORGANIZATION_LEAVE_PATH } as never)).toBe(true)
    expect(matcher?.({ path: '/organization/remove-member' } as never)).toBe(
      false,
    )
    expect(matcher?.({ path: '/organization/delete' } as never)).toBe(false)
    expect(deleteCustomer).not.toHaveBeenCalled()
  })

  it('skips profile and deletion sync for existing unsynchronized organizations', async () => {
    const { context } = createAuthContext()
    vi.mocked(isTeamCustomerSynchronized).mockResolvedValue(false)

    await synchronizeUserOrganizationProfiles(
      context,
      client,
      user,
      organizationOptions,
    )
    await synchronizeUserDeletionMemberships(
      context,
      client,
      user,
      organizationOptions,
    )

    expect(updateMemberMirror).not.toHaveBeenCalled()
    expect(removeMemberMirror).not.toHaveBeenCalled()
  })

  it('uses the user delete before-state for every membership', async () => {
    const { context, adapter } = createAuthContext()

    await synchronizeUserDeletionMemberships(
      context,
      client,
      user,
      organizationOptions,
    )

    expect(removeMemberMirror).toHaveBeenCalledTimes(2)
    const removals = vi
      .mocked(removeMemberMirror)
      .mock.calls.map((call) => call[1])
    const organizationARemoval = removals.find(
      (removal) => removal.organizationId === 'org-a',
    )
    const organizationBRemoval = removals.find(
      (removal) => removal.organizationId === 'org-b',
    )
    expect(organizationARemoval).toEqual({
      organizationId: 'org-a',
      externalMemberId: user.id,
    })
    expect(organizationBRemoval).toEqual({
      organizationId: 'org-b',
      externalMemberId: user.id,
    })
    expect(
      vi
        .mocked(adapter.findMany)
        .mock.calls.filter(([call]) => call.model === 'member'),
    ).toHaveLength(2)
  })
})
