'use client'

import { useListMemberOrganizations } from '@/hooks/queries'
import type { Organization } from '@polar-sh/sdk'
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
  const listOrganizationsQuery = useListMemberOrganizations()
  return listOrganizationsQuery.data?.items?.some((o) => o.id === org?.id)
}
