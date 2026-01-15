'use client'

import { useOrganization } from './queries/org'

/**
 * Hook to check if the member model is enabled for an organization.
 *
 * The member model enables organizations to create Members and uses
 * Members under the hood for seat-based pricing functionality.
 */
export const useMemberModelEnabled = (organizationId: string) => {
  const { data: organization, isLoading } = useOrganization(
    organizationId,
    !!organizationId,
  )

  const isEnabled =
    organization?.feature_settings?.member_model_enabled ?? false

  return { isEnabled, isLoading }
}
