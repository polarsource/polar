import { api } from '@/utils/api'
import { useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useStorefront = (organizationSlug: string) =>
  useQuery({
    queryKey: ['storefront', { organizationSlug }],
    queryFn: () =>
      api.storefronts.get({
        slug: organizationSlug,
      }),
    retry: defaultRetry,
  })
