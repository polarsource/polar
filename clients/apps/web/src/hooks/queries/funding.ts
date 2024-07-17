import { api } from '@/utils/api'
import { ListFundingSortBy, ListResourceIssueFunding } from '@polar-sh/sdk'
import { UseQueryResult, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useSearchFunding: (v: {
  organizationId?: string
  repositoryName?: string
  q?: string
  sort?: Array<ListFundingSortBy>
  badged?: boolean
  limit?: number
  closed?: boolean
  page?: number
}) => UseQueryResult<ListResourceIssueFunding> = (v: {
  organizationId?: string
  repositoryName?: string
  q?: string
  sort?: Array<ListFundingSortBy>
  badged?: boolean
  limit?: number
  closed?: boolean
  page?: number
}) =>
  useQuery({
    queryKey: ['funded_issues', { ...v }],
    queryFn: () =>
      api.funding.search({
        organizationId: v.organizationId as string,
        repositoryName: v.repositoryName,
        query: v.q,
        sorting: v.sort,
        badged: v.badged,
        limit: v.limit || 100,
        page: v.page,
        closed: v.closed,
      }),
    retry: defaultRetry,
    enabled: !!v.organizationId,
  })
