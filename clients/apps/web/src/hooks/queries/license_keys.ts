import { useQuery } from '@tanstack/react-query'

import { api } from '@/utils/api'
import { LicenseKeysApiListRequest } from '@polar-sh/sdk'
import { defaultRetry } from './retry'

interface GetLicenseKeysRequest {
  licenseKeyId?: string
}

export const useLicenseKey = ({ licenseKeyId }: GetLicenseKeysRequest) =>
  useQuery({
    queryKey: ['user', 'license_key', licenseKeyId],
    queryFn: () =>
      api.usersLicenseKeys.get({
        id: licenseKeyId as string,
      }),
    retry: defaultRetry,
    enabled: !!licenseKeyId,
  })

export const useOrganizationLicenseKeys = ({
  organizationId,
  page,
  limit,
}: LicenseKeysApiListRequest) =>
  useQuery({
    queryKey: ['license_keys', 'organization', organizationId, { page, limit }],
    queryFn: () =>
      api.licenseKeys.list({
        organizationId,
        page,
        limit,
      }),
    retry: defaultRetry,
    enabled: !!organizationId,
  })
