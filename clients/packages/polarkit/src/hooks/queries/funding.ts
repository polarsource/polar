import {
  ListFundingSortBy,
  ListResourceIssueFunding,
  Platforms,
} from '@polar-sh/sdk'
import { UseQueryResult, useQuery } from '@tanstack/react-query'
import { api } from '../../..'
import { defaultRetry } from './retry'

export const useSearchFundedIssues: (v: {
  organizationName?: string
  repositoryName?: string
  sort?: Array<ListFundingSortBy>
  badged?: boolean
}) => UseQueryResult<ListResourceIssueFunding> = (v: {
  organizationName?: string
  repositoryName?: string
  sort?: Array<ListFundingSortBy>
  badged?: boolean
}) =>
  useQuery({
    queryKey: [
      'funded_issues',
      v.organizationName,
      v.repositoryName,
      JSON.stringify({
        sort: v.sort,
        badged: v.badged,
      }),
    ],
    queryFn: () =>
      api.funding.search({
        platform: Platforms.GITHUB,
        organizationName: v.organizationName || '',
        repositoryName: v.repositoryName,
        sorting: v.sort,
        badged: v.badged,
      }),
    retry: defaultRetry,
    enabled: !!v.organizationName,
  })
