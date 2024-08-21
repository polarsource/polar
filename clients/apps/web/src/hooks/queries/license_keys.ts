import { useQuery } from '@tanstack/react-query'

import { api } from '@/utils/api'
import { defaultRetry } from './retry'

export const useLicenseKeys = (organizationId: string, benefitId: string) =>
  useQuery({
    queryKey: ['user', 'license_keys', organizationId, benefitId],
    queryFn: () =>
      api.users.listLicenseKeys({
        organizationId: organizationId,
        benefitId: benefitId,
      }),
    retry: defaultRetry,
  })
