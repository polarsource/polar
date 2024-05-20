import { useQuery } from '@tanstack/react-query'

import { api } from '@/utils/api'
import { defaultRetry } from './retry'

export const useSubscriberAccessibleFiles = (benefitId?: string, limit = 30) =>
  useQuery({
    queryKey: ['user', 'files', benefitId],
    queryFn: () =>
      api.files.getUserAccessibleFiles({
        benefitId,
        limit,
      }),
    retry: defaultRetry,
  })
