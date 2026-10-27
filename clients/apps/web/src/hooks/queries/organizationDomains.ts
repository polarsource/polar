import { getQueryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

const invalidateOrganizationDomainsQueries = (organizationId: string) => {
  getQueryClient().invalidateQueries({
    queryKey: ['organization_domains', { organizationId }],
  })
  getQueryClient().invalidateQueries({
    queryKey: ['organizationReviewState', organizationId],
  })
}

export const useOrganizationDomains = (organizationId: string) =>
  useQuery({
    queryKey: ['organization_domains', { organizationId }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/organizations/{id}/domains/', {
          params: { path: { id: organizationId }, query: { limit: 100 } },
        }),
      ),
    retry: defaultRetry,
  })

export const useCreateOrganizationDomain = (organizationId: string) =>
  useMutation({
    mutationFn: (body: schemas['OrganizationDomainCreate']) =>
      api.POST('/v1/organizations/{id}/domains/', {
        params: { path: { id: organizationId } },
        body,
      }),
    onSuccess: ({ error }) => {
      if (error) return
      invalidateOrganizationDomainsQueries(organizationId)
    },
  })

export const useVerifyOrganizationDomain = (organizationId: string) =>
  useMutation({
    mutationFn: (domainId: string) =>
      api.POST('/v1/organizations/{id}/domains/{domain_id}/verify', {
        params: { path: { id: organizationId, domain_id: domainId } },
      }),
    onSuccess: ({ error }) => {
      if (error) return
      invalidateOrganizationDomainsQueries(organizationId)
    },
  })

export const useDeleteOrganizationDomain = (organizationId: string) =>
  useMutation({
    mutationFn: (domainId: string) =>
      api.DELETE('/v1/organizations/{id}/domains/{domain_id}', {
        params: { path: { id: organizationId, domain_id: domainId } },
      }),
    onSuccess: ({ error }) => {
      if (error) return
      invalidateOrganizationDomainsQueries(organizationId)
    },
  })
