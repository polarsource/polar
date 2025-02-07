import { useQuery } from '@tanstack/react-query'

import { api } from '@/utils/client'
import { unwrap } from '@polar-sh/client'
import { defaultRetry } from './retry'

export const useAdvertisementDisplays = (benefit_id: string) =>
  useQuery({
    queryKey: ['advertisements', 'displays', benefit_id],
    queryFn: () =>
      unwrap(
        api.GET('/v1/advertisements/', { params: { query: { benefit_id } } }),
      ),
    retry: defaultRetry,
  })
