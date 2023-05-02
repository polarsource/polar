import { useInfiniteQuery, UseInfiniteQueryResult } from '@tanstack/react-query'
import { api } from '../../api'
import {
  IssueListResponse,
  IssueListType,
  IssueSortBy,
  IssueStatus,
  Platforms,
} from '../../api/client'
import { defaultRetry } from './retry'

export const useDashboard = (
  orgName: string,
  repoName?: string,
  tab?: IssueListType,
  q?: string,
  status?: Array<IssueStatus>,
  sort?: IssueSortBy,
  onlyPledged?: boolean,
): UseInfiniteQueryResult<IssueListResponse> =>
  useInfiniteQuery({
    queryKey: [
      'dashboard',
      'repo',
      orgName,
      repoName,
      tab,
      q,
      JSON.stringify(status), // Array as cache key,
      sort,
      onlyPledged,
    ],
    queryFn: ({ signal, pageParam = 1 }) => {
      const promise = api.dashboard.getDashboard({
        platform: Platforms.GITHUB,
        orgName: orgName,
        repoName: repoName,
        issueListType: tab,
        q: q,
        status: status,
        sort: sort,
        onlyPledged: onlyPledged,
        page: pageParam,
      })

      signal?.addEventListener('abort', () => {
        promise.cancel()
      })

      return promise
    },
    getNextPageParam: (lastPage, pages): number | undefined => {
      return lastPage.pagination.next_page
    },
    enabled: !!orgName,
    retry: defaultRetry,
  })

export const usePersonalDashboard = (
  tab?: IssueListType,
  q?: string,
  status?: Array<IssueStatus>,
  sort?: IssueSortBy,
  onlyPledged?: boolean,
): UseInfiniteQueryResult<IssueListResponse> =>
  useInfiniteQuery({
    queryKey: [
      'personalDashboard',
      tab,
      q,
      JSON.stringify(status), // Array as cache key,
      sort,
      onlyPledged,
    ],
    queryFn: ({ signal, pageParam }) => {
      const promise = api.dashboard.getPersonalDashboard({
        issueListType: tab,
        q: q,
        status: status,
        sort: sort,
        onlyPledged,
        page: pageParam,
      })

      signal?.addEventListener('abort', () => {
        promise.cancel()
      })

      return promise
    },
    getNextPageParam: (lastPage, pages): number | undefined => {
      return lastPage.pagination.next_page
    },
    retry: defaultRetry,
  })
