import { getQueryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useOrganizationEmail = (organizationId: string) =>
  useQuery({
    queryKey: ['organization_email', { organizationId }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/organizations/{id}/email/', {
          params: { path: { id: organizationId } },
        }),
      ),
    retry: defaultRetry,
  })

export const useSendOrganizationEmailCode = (organizationId: string) =>
  useMutation({
    mutationFn: () =>
      api.POST('/v1/organizations/{id}/email/send-code', {
        params: { path: { id: organizationId } },
      }),
    onSuccess: ({ error }) => {
      if (error) return
      getQueryClient().invalidateQueries({
        queryKey: ['organization_email', { organizationId }],
      })
    },
  })

export const useVerifyOrganizationEmail = (organizationId: string) =>
  useMutation({
    mutationFn: (body: schemas['OrganizationEmailVerify']) =>
      api.POST('/v1/organizations/{id}/email/verify', {
        params: { path: { id: organizationId } },
        body,
      }),
    onSuccess: ({ error }) => {
      if (error) return
      getQueryClient().invalidateQueries({
        queryKey: ['organization_email', { organizationId }],
      })
      getQueryClient().invalidateQueries({
        queryKey: ['organizationReviewState', organizationId],
      })
    },
  })
