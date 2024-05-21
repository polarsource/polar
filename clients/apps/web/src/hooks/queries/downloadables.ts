import { useQuery } from '@tanstack/react-query'

import { api } from '@/utils/api'
import { defaultRetry } from './retry'

export const useDownloadables = (benefitId?: string, limit = 30) =>
  useQuery({
    queryKey: ['user', 'files', benefitId],
    queryFn: () =>
      api.downloadables.list({
        benefitId,
        limit,
      }),
    retry: defaultRetry,
  })
