import { api } from '@/utils/client'
import { operations, unwrap } from '@polar-sh/client'
import { useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useGetPledge = (pledgeId: string | null) =>
  useQuery({
    queryKey: ['pledge', pledgeId],
    queryFn: () =>
      unwrap(
        api.GET('/v1/pledges/{id}', {
          params: { path: { id: pledgeId ?? '' } },
        }),
      ),
    enabled: !!pledgeId,
    retry: defaultRetry,
  })

export const useSearchPledges = (
  params: operations['pledges:search']['parameters']['query'],
) =>
  useQuery({
    queryKey: ['pledges', { ...params }],
    queryFn: () =>
      unwrap(api.GET('/v1/pledges/search', { params: { query: params } })),
    retry: defaultRetry,
  })

export const useListPledesForIssue = (issueId: string) =>
  useSearchPledges({ issue_id: issueId })

export const useListPledgesForOrganization = (organizationId: string) =>
  useSearchPledges({ organization_id: organizationId })
