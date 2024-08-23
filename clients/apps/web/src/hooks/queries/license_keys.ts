import { useQuery } from '@tanstack/react-query'

import { api } from '@/utils/api'
import { defaultRetry } from './retry'

interface GetLicenseKeysRequest {
  licenseKeyId: string
}

export const useLicenseKey = ({ licenseKeyId }: GetLicenseKeysRequest) =>
  useQuery({
    queryKey: ['user', 'license_key', licenseKeyId],
    queryFn: () =>
      api.users.getLicenseKey({
        id: licenseKeyId,
      }),
    retry: defaultRetry,
  })
