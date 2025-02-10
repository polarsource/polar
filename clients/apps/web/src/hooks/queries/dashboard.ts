import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import {
  InfiniteData,
  UseInfiniteQueryResult,
  useInfiniteQuery,
} from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useDashboard = (vars: {
  organizationId: string
  repoName?: string
  q?: string
  sort?: schemas['IssueSortBy']
  onlyPledged?: boolean
  onlyBadged?: boolean
  hasAppInstalled?: boolean
  showClosed: boolean
}): UseInfiniteQueryResult<
  InfiniteData<schemas['IssueListResponse'], unknown>
> =>
  useInfiniteQuery({
    queryKey: [
      'dashboard',
      'repo',
      vars.organizationId,
      vars.repoName,
      JSON.stringify(vars),
    ],
    queryFn: ({ pageParam = 1 }) =>
      unwrap(
        api.GET('/v1/dashboard/organization/{id}', {
          params: {
            path: {
              id: vars.organizationId,
            },
            query: {
              repository_name: vars.repoName,
              q: vars.q,
              sort: vars.sort,
              only_pledged: vars.onlyPledged,
              only_badged: vars.onlyBadged,
              show_closed: vars.showClosed,
              page: pageParam,
            },
          },
        }),
      ),
    getNextPageParam: (lastPage, _pages): number | null => {
      return lastPage.pagination.next_page
    },
    initialPageParam: 1,
    enabled: !!vars.hasAppInstalled,
    retry: defaultRetry,
  })

export const usePersonalDashboard = (vars: {
  q?: string
  sort?: schemas['IssueSortBy']
  onlyPledged?: boolean
  onlyBadged?: boolean
  showClosed?: boolean
}) =>
  useInfiniteQuery({
    queryKey: ['dashboard', 'personal', JSON.stringify(vars)],
    queryFn: ({ pageParam }) =>
      unwrap(
        api.GET('/v1/dashboard/personal', {
          params: {
            query: {
              q: vars.q,
              sort: vars.sort,
              only_pledged: vars.onlyPledged,
              only_badged: vars.onlyBadged,
              show_closed: vars.showClosed,
              page: pageParam,
            },
          },
        }),
      ),
    getNextPageParam: (lastPage, _pages): number | null => {
      return lastPage.pagination.next_page
    },
    initialPageParam: 1,
    retry: defaultRetry,
  })
