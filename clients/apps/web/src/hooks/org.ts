'use client'

import { components } from '@polar-sh/client'
import { useAuth } from './auth'
import { useExternalOrganizations } from './queries/externalOrganizations'

export const useHasLinkedExternalOrganizations = (
  organization: components['schemas']['Organization'],
): boolean => {
  const { data: externalOrganizations } = useExternalOrganizations({
    organization_id: organization.id,
  })
  return (
    externalOrganizations !== undefined &&
    externalOrganizations.pagination.total_count > 0
  )
}

export const useIsOrganizationMember = (
  org?: components['schemas']['Organization'],
) => {
  const { userOrganizations } = useAuth()
  return userOrganizations.some((o) => o.id === org?.id)
}
