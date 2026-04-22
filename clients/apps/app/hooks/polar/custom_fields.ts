import { usePolarClient } from '@/providers/PolarClientProvider'
import { operations, unwrap } from '@polar-sh/client'
import { useQuery } from '@tanstack/react-query'

export const useCustomFields = (
  organizationId: string | undefined,
  parameters?: Omit<
    NonNullable<operations['custom-fields:list']['parameters']['query']>,
    'organization_id'
  >,
) => {
  const { polar } = usePolarClient()

  return useQuery({
    queryKey: ['custom_fields', { organizationId, ...(parameters || {}) }],
    queryFn: () =>
      unwrap(
        polar.GET('/v1/custom-fields/', {
          params: {
            query: {
              organization_id: organizationId,
              ...(parameters || {}),
            },
          },
        }),
      ),
    enabled: !!organizationId,
  })
}
