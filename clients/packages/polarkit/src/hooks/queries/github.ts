import { OrganizationBillingPlan } from '@polar-sh/sdk'
import { UseQueryResult, useQuery } from '@tanstack/react-query'
import { api } from '../../api'
import { defaultRetry } from './retry'

export const useGetOrganizationBillingPlan: (
  id?: string,
) => UseQueryResult<OrganizationBillingPlan | undefined> = (id) =>
  useQuery({
    queryKey: ['organization_billing_plan', id],
    queryFn: () =>
      api.integrations.getOrganizationBillingPlan({
        id: id || '',
      }),
    retry: defaultRetry,
    enabled: !!id,
  })
