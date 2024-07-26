'use client'

import type { Organization } from '@polar-sh/sdk'
import { useAuth } from './auth'
import { useExternalOrganizations } from './queries/externalOrganizations'

export const useHasLinkedExternalOrganizations = (
  organization: Organization,
): boolean => {
  const { data: externalOrganizations } = useExternalOrganizations({
    organizationId: organization.id,
  })
  return (
    externalOrganizations !== undefined &&
    externalOrganizations.pagination.total_count > 0
  )
}

export const useIsOrganizationMember = (org?: Organization) => {
  const { userOrganizations } = useAuth()
  return userOrganizations.some((o) => o.id === org?.id)
}
