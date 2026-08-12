import { renderHook } from '@testing-library/react'
import { schemas } from '@polar-sh/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authState = vi.hoisted(() => ({
  organizations: [] as schemas['OrganizationWithRole'][],
}))

vi.mock('@/hooks/auth', () => ({
  useAuth: () => ({ userOrganizations: authState.organizations }),
}))

import { useHasPermission, useOrganizationPermissions } from './permissions'

const financeOrganization = {
  id: 'finance-organization',
  permissions: [
    'sales:read',
    'sales:manage',
    'finance:read',
    'customers:read',
    'products:read',
    'custom_fields:read',
    'analytics:read',
  ],
} as schemas['OrganizationWithRole']

describe('organization permissions', () => {
  beforeEach(() => {
    authState.organizations = [financeOrganization]
  })

  it('returns the permissions embedded for the organization', () => {
    const { result } = renderHook(() =>
      useOrganizationPermissions(financeOrganization.id),
    )

    expect(result.current).toEqual(financeOrganization.permissions)
  })

  it('grants finance permissions and denies admin permissions', () => {
    const { result: canReadFinance } = renderHook(() =>
      useHasPermission(financeOrganization.id, 'finance:read'),
    )
    const { result: canManageFinance } = renderHook(() =>
      useHasPermission(financeOrganization.id, 'finance:manage'),
    )
    const { result: canManageMembers } = renderHook(() =>
      useHasPermission(financeOrganization.id, 'members:manage'),
    )

    expect(canReadFinance.current).toBe(true)
    expect(canManageFinance.current).toBe(false)
    expect(canManageMembers.current).toBe(false)
  })

  it('denies permissions when the organization is unavailable', () => {
    const { result } = renderHook(() =>
      useHasPermission('unknown-organization', 'finance:read'),
    )

    expect(result.current).toBe(false)
  })
})
