import { useQuery } from '@tanstack/react-query'

import { api } from '@/utils/api'
import { defaultRetry } from './retry'

export const useAdvertisementDisplays = (benefit_id: string) =>
  useQuery({
    queryKey: ['advertisements', 'displays', benefit_id],
    queryFn: () =>
      api.advertisements.list({
        benefitId: benefit_id,
      }),
    retry: defaultRetry,
  })
