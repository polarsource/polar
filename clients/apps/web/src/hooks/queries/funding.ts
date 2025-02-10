import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import { UseQueryResult, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useSearchFunding: (v: {
  organizationId?: string
  repositoryName?: string
  q?: string
  sort?: Array<schemas['ListFundingSortBy']>
  badged?: boolean
  limit?: number
  closed?: boolean
  page?: number
}) => UseQueryResult<schemas['ListResource_IssueFunding_']> = (v: {
  organizationId?: string
  repositoryName?: string
  q?: string
  sort?: Array<schemas['ListFundingSortBy']>
  badged?: boolean
  limit?: number
  closed?: boolean
  page?: number
}) =>
  useQuery({
    queryKey: ['funded_issues', { ...v }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/funding/search', {
          params: {
            query: {
              organization_id: v.organizationId ?? '',
              repository_name: v.repositoryName,
              q: v.q,
              sort: v.sort,
              badged: v.badged,
              limit: v.limit,
              closed: v.closed,
              page: v.page,
            },
          },
        }),
      ),
    retry: defaultRetry,
    enabled: !!v.organizationId,
  })
