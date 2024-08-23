import { useQuery } from '@tanstack/react-query'

import { api } from '@/utils/api'
import { defaultRetry } from './retry'

export const useLicenseKey = (licenseKeyId: string) =>
  useQuery({
    queryKey: ['user', 'license_key', licenseKeyId],
    queryFn: () =>
      api.users.getLicenseKey({
        id: licenseKeyId,
      }),
    retry: defaultRetry,
  })
