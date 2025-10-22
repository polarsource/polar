import { useMutation, useQuery } from '@tanstack/react-query'

import { getQueryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { operations, schemas, unwrap } from '@polar-sh/client'
import { defaultRetry } from './retry'

export const useLicenseKeyUpdate = (organizationId: string) =>
  useMutation({
    mutationFn: (variables: {
      id: string
      body: schemas['LicenseKeyUpdate']
    }) =>
      api.PATCH('/v1/license-keys/{id}', {
        params: { path: { id: variables.id } },
        body: variables.body,
      }),
    onSuccess: async (result, _variables, _ctx) => {
      if (result.error) {
        return
      }
      const queryClient = getQueryClient()
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
    queryFn: () =>
      unwrap(
        api.GET('/v1/license-keys/{id}', {
          params: { path: { id: id ?? '' } },
        }),
      ),
    retry: defaultRetry,
    enabled: !!id,
  })

export const useOrganizationLicenseKeys = ({
  organization_id,
  benefit_id,
  page,
  limit,
}: NonNullable<operations['license_keys:list']['parameters']['query']>) =>
  useQuery({
    queryKey: [
      'license_keys',
      'organization',
      organization_id,
      { page, limit, benefit_id },
    ],
    queryFn: () =>
      unwrap(
        api.GET('/v1/license-keys/', {
          params: {
            query: {
              organization_id,
              benefit_id,
              page,
              limit,
            },
          },
        }),
      ),
    retry: defaultRetry,
    enabled: !!organization_id,
  })
