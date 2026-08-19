import { useMutation, useQuery } from '@tanstack/react-query'

import { getQueryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { operations, schemas, unwrap } from '@polar-sh/client'
import { defaultRetry } from './retry'

const applyLicenseKeyToCaches = (
  organizationId: string,
  id: string,
  data: schemas['LicenseKeyRead'],
) => {
  const queryClient = getQueryClient()
  queryClient.setQueryData(
    ['license_keys', id],
    (old: schemas['LicenseKeyWithActivations'] | undefined) => {
      if (!old) {
        return { ...data, activations: [] }
      }
      return { ...old, ...data }
    },
  )
  queryClient.setQueriesData<schemas['ListResource_LicenseKeyRead_']>(
    { queryKey: ['license_keys', 'organization', organizationId] },
    (old) => {
      if (!old) {
        return old
      }
      return {
        ...old,
        items: old.items.map((item) =>
          item.id === id ? { ...item, ...data } : item,
        ),
      }
    },
  )
  queryClient.invalidateQueries({
    queryKey: ['license_keys', 'organization', organizationId],
  })
}

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
    onSuccess: async (result, variables) => {
      if (result.error) {
        return
      }
      applyLicenseKeyToCaches(organizationId, variables.id, result.data)
    },
  })

export const useLicenseKeyRotate = (organizationId: string) =>
  useMutation({
    mutationFn: (id: string) =>
      api.POST('/v1/license-keys/{id}/rotate', {
        params: { path: { id } },
      }),
    onSuccess: async (result, id) => {
      if (result.error) {
        return
      }
      applyLicenseKeyToCaches(organizationId, id, result.data)
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
  status,
  page,
  limit,
}: NonNullable<operations['license_keys:list']['parameters']['query']>) =>
  useQuery({
    queryKey: [
      'license_keys',
      'organization',
      organization_id,
      { page, limit, benefit_id, status },
    ],
    queryFn: () =>
      unwrap(
        api.GET('/v1/license-keys/', {
          params: {
            query: {
              organization_id,
              benefit_id,
              status,
              page,
              limit,
            },
          },
        }),
      ),
    retry: defaultRetry,
    enabled: !!organization_id,
  })
