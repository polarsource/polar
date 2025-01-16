import { useMutation, useQuery } from '@tanstack/react-query'

import { api, queryClient } from '@/utils/api'
import {
  LicenseKeysApiListRequest,
  LicenseKeysApiUpdateRequest,
} from '@polar-sh/sdk'
import { defaultRetry } from './retry'

export const useLicenseKeyUpdate = (organizationId: string) =>
  useMutation({
    mutationFn: (update: LicenseKeysApiUpdateRequest) =>
      api.licenseKeys.update(update),
    onSuccess: async (_result, _variables, _ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['license_keys', 'organization', organizationId],
      })

      queryClient.invalidateQueries({
        queryKey: ['license_keys', _variables.id],
      })
    },
  })

export const useLicenseKey = (id?: string) =>
  useQuery({
    queryKey: ['license_keys', id],
    queryFn: () => api.licenseKeys.get({ id: id as string }),
    retry: defaultRetry,
    enabled: !!id,
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
