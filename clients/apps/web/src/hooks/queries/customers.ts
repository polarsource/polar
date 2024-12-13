import { api } from '@/utils/api'
import { CustomersApiListRequest } from '@polar-sh/sdk'
import { useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useCustomers = (
  organizationId: string,
  parameters?: Omit<CustomersApiListRequest, 'organization_id'>,
) =>
  useQuery({
    queryKey: ['customers', { organizationId, ...(parameters || {}) }],
    queryFn: () =>
      api.customers.list({
        organizationId: organizationId ?? '',
        ...(parameters || {}),
      }),
    retry: defaultRetry,
  })
