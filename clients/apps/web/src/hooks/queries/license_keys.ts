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

export const useLicenseKeyDeactivation = (licenseKeyId: string) =>
  useMutation({
    mutationFn: (opts: {
      key: string
      organizationId: string
      activationId: string
    }) =>
      api.usersLicenseKeys.deactivate({
        body: {
          key: opts.key,
          organization_id: opts.organizationId,
          activation_id: opts.activationId,
        },
      }),
    onSuccess: async (_result, _variables, _ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['user', 'license_key', licenseKeyId],
      })
    },
  })

export const useOrganizationLicenseKeys = ({
  organizationId,
  benefitId,
  page,
  limit,
}: LicenseKeysApiListRequest) =>
  useQuery({
    queryKey: [
      'license_keys',
      'organization',
      organizationId,
      { page, limit, benefitId },
    ],
    queryFn: () =>
      api.licenseKeys.list({
        organizationId,
        benefitId,
        page,
        limit,
      }),
    retry: defaultRetry,
    enabled: !!organizationId,
  })
