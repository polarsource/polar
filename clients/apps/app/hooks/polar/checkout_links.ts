import { usePolarClient } from '@/providers/PolarClientProvider'
import { operations, unwrap } from '@polar-sh/client'
import { useQuery } from '@tanstack/react-query'

export const useCheckoutLinks = (
  organizationId: string | undefined,
  params: Omit<
    operations['checkout-links:list']['parameters']['query'],
    'organization_id'
  >,
) => {
  const { polar } = usePolarClient()

  return useQuery({
    queryKey: ['checkout_links', organizationId, { ...params }],
    queryFn: () =>
      unwrap(
        polar.GET('/v1/checkout-links/', {
          params: {
            query: {
              organization_id: organizationId,
              ...params,
            },
          },
        }),
      ),
    enabled: !!organizationId,
  })
}
