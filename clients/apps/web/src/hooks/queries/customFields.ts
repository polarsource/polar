import { api } from '@/utils/api'
import { CustomFieldsApiListRequest } from '@polar-sh/sdk'
import { useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useCustomFields = (
  organizationId: string,
  parameters?: Omit<CustomFieldsApiListRequest, 'organization_id'>,
) =>
  useQuery({
    queryKey: ['custom_fields', { organizationId, ...(parameters || {}) }],
    queryFn: () =>
      api.customFields.list({
        organizationId,
        ...(parameters || {}),
      }),
    retry: defaultRetry,
  })
