import { useQuery } from '@tanstack/react-query'

import { api } from '@/utils/api'
import { defaultRetry } from './retry'

export const useFiles = (organizationId: string, benefitId: string) =>
  useQuery({
    queryKey: ['user', 'files', organizationId, benefitId],
    queryFn: () =>
      api.files.listDownloadables({
        organizationId,
        benefitId,
      }),
    retry: defaultRetry,
  })
