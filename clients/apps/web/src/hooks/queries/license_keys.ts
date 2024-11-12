import { useMutation, useQuery } from '@tanstack/react-query'

import { api, queryClient } from '@/utils/api'
import {
  LicenseKeysApiListRequest,
  LicenseKeysApiUpdateRequest,
} from '@polar-sh/sdk'
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

export const useLicenseKeyUpdate = (organizationId: string) =>
  useMutation({
    mutationFn: (update: LicenseKeysApiUpdateRequest) =>
      api.licenseKeys.update(update),
    onSuccess: async (_result, _variables, _ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['license_keys', 'organization', organizationId],
      })
    },
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
