import { api } from '@/utils/api'
import {
  IssueListResponse,
  IssueSortBy,
  IssueStatus,
  Platforms,
} from '@polar-sh/sdk'
import {
  InfiniteData,
  UseInfiniteQueryResult,
  useInfiniteQuery,
} from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useDashboard = (
  orgName: string,
  repoName?: string,
  q?: string,
  status?: Array<IssueStatus>,
  sort?: IssueSortBy,
  onlyPledged?: boolean,
  onlyBadged?: boolean,
  hasAppInstalled?: boolean,
): UseInfiniteQueryResult<InfiniteData<IssueListResponse, unknown>> =>
  useInfiniteQuery({
    queryKey: [
      'dashboard',
      'repo',
      orgName,
      repoName,
      q,
      JSON.stringify(status), // Array as cache key,
      sort,
      onlyPledged,
      onlyBadged,
      hasAppInstalled,
    ],
    queryFn: ({ signal, pageParam = 1 }) => {
      const promise = api.dashboard.getDashboard({
        platform: Platforms.GITHUB,
        orgName: orgName,
        repoName: repoName,
        q: q,
        status: status,
        sort: sort,
        onlyPledged: onlyPledged,
        onlyBadged: onlyBadged,
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
    enabled: !!orgName && !!hasAppInstalled,
    retry: defaultRetry,
  })

export const usePersonalDashboard = (
  q?: string,
  status?: Array<IssueStatus>,
  sort?: IssueSortBy,
  onlyPledged?: boolean,
  onlyBadged?: boolean,
) =>
  useInfiniteQuery({
    queryKey: [
      'dashboard',
      'personal',
      q,
      JSON.stringify(status), // Array as cache key,
      sort,
      onlyPledged,
      onlyBadged,
    ],
    queryFn: ({ signal, pageParam }) => {
      const promise = api.dashboard.getPersonalDashboard({
        q: q,
        status: status,
        sort: sort,
        onlyPledged,
        onlyBadged: onlyBadged,
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
    retry: defaultRetry,
  })
