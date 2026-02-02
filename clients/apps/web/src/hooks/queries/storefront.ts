import { api } from '@/utils/client'
import { unwrap } from '@spaire/client'
import { useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useStorefront = (organizationSlug: string) =>
  useQuery({
    queryKey: ['storefront', { organizationSlug }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/storefronts/{slug}', {
          params: {
            path: { slug: organizationSlug },
          },
        }),
      ),
    retry: defaultRetry,
  })
