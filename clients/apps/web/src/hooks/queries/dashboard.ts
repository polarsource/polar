import { api } from '@/utils/api'
import { IssueListResponse, IssueSortBy, Platforms } from '@polar-sh/sdk'
import {
  InfiniteData,
  UseInfiniteQueryResult,
  useInfiniteQuery,
} from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useDashboard = (vars: {
  orgName: string
  repoName?: string
  q?: string
  sort?: IssueSortBy
  onlyPledged?: boolean
  onlyBadged?: boolean
  hasAppInstalled?: boolean
  showClosed: boolean
}): UseInfiniteQueryResult<InfiniteData<IssueListResponse, unknown>> =>
  useInfiniteQuery({
    queryKey: [
      'dashboard',
      'repo',
      vars.orgName,
      vars.repoName,
      JSON.stringify(vars),
    ],
    queryFn: ({ signal, pageParam = 1 }) => {
      const promise = api.dashboard.getDashboard({
        platform: Platforms.GITHUB,
        orgName: vars.orgName,
        repoName: vars.repoName,
        q: vars.q,
        sort: vars.sort,
        onlyPledged: vars.onlyPledged,
        onlyBadged: vars.onlyBadged,
        showClosed: vars.showClosed,
        page: pageParam,
      })

      signal?.addEventListener('abort', () => {
        // TODO!
        // promise.cancel()
      })

      return promise
    },
    getNextPageParam: (lastPage, _pages): number | undefined => {
      return lastPage.pagination.next_page
    },
    initialPageParam: 1,
    enabled: !!vars.orgName && !!vars.hasAppInstalled,
    retry: defaultRetry,
  })

export const usePersonalDashboard = (vars: {
  q?: string
  sort?: IssueSortBy
  onlyPledged?: boolean
  onlyBadged?: boolean
  showClosed?: boolean
}) =>
  useInfiniteQuery({
    queryKey: ['dashboard', 'personal', JSON.stringify(vars)],
    queryFn: ({ signal, pageParam }) => {
      const promise = api.dashboard.getPersonalDashboard({
        q: vars.q,
        sort: vars.sort,
        onlyPledged: vars.onlyPledged,
        onlyBadged: vars.onlyBadged,
        page: pageParam,
        showClosed: vars.showClosed,
      })

      signal?.addEventListener('abort', () => {
        // TODO!
        // promise.cancel()
      })

      return promise
    },
    getNextPageParam: (lastPage, _pages): number | undefined => {
      return lastPage.pagination.next_page
    },
    initialPageParam: 1,
    retry: defaultRetry,
  })
