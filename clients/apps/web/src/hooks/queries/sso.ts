import { getQueryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

const invalidateSSOConnectionsQueries = (organizationId: string) => {
  getQueryClient().invalidateQueries({
    queryKey: ['sso_connections', { organizationId }],
  })
}

export const useSSOConnections = (organizationId: string) =>
  useQuery({
    queryKey: ['sso_connections', { organizationId }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/organizations/{id}/sso-connections/', {
          params: { path: { id: organizationId } },
        }),
      ),
    retry: defaultRetry,
  })

export const useCreateSSOConnection = (organizationId: string) =>
  useMutation({
    mutationFn: (body: schemas['OrganizationSSOConnectionCreate']) =>
      api.POST('/v1/organizations/{id}/sso-connections/', {
        params: { path: { id: organizationId } },
        body,
      }),
    onSuccess: ({ error }) => {
      if (error) return
      invalidateSSOConnectionsQueries(organizationId)
    },
  })

export const useUpdateSSOConnection = (
  organizationId: string,
  connectionId: string,
) =>
  useMutation({
    mutationFn: (body: schemas['OrganizationSSOConnectionUpdate']) =>
      api.PATCH('/v1/organizations/{id}/sso-connections/{connection_id}', {
        params: { path: { id: organizationId, connection_id: connectionId } },
        body,
      }),
    onSuccess: ({ error }) => {
      if (error) return
      invalidateSSOConnectionsQueries(organizationId)
    },
  })

export const useDeleteSSOConnection = (organizationId: string) =>
  useMutation({
    mutationFn: (connectionId: string) =>
      api.DELETE('/v1/organizations/{id}/sso-connections/{connection_id}', {
        params: { path: { id: organizationId, connection_id: connectionId } },
      }),
    onSuccess: ({ error }) => {
      if (error) return
      invalidateSSOConnectionsQueries(organizationId)
    },
  })
