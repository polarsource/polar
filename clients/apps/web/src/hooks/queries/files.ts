import { useQuery } from '@tanstack/react-query'

import { api } from '@/utils/api'
import { defaultRetry } from './retry'

export const useFiles = (organizationId: string, ids?: string[], limit = 30) =>
  useQuery({
    queryKey: ['user', 'files', organizationId, { ids, limit }],
    queryFn: () =>
      api.files.list({
        organizationId,
        ids,
        limit,
      }),
    retry: defaultRetry,
  })
