import { useQuery, UseQueryResult } from '@tanstack/react-query'
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
): UseQueryResult<IssueListResponse> =>
  useQuery(
    [
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
    ({ signal }) => {
      const promise = api.dashboard.getDashboard({
        platform: Platforms.GITHUB,
        orgName: orgName,
        repoName: repoName,
        issueListType: tab,
        q: q,
        status: status,
        sort: sort,
        onlyPledged: onlyPledged,
      })

      signal?.addEventListener('abort', () => {
        promise.cancel()
      })

      return promise
    },
    {
      enabled: !!orgName,
      retry: defaultRetry,
    },
  )

export const usePersonalDashboard = (
  tab?: IssueListType,
  q?: string,
  status?: Array<IssueStatus>,
  sort?: IssueSortBy,
  onlyPledged?: boolean,
): UseQueryResult<IssueListResponse> =>
  useQuery(
    [
      'personalDashboard',
      tab,
      q,
      JSON.stringify(status), // Array as cache key,
      sort,
      onlyPledged,
    ],
    ({ signal }) => {
      const promise = api.dashboard.getPersonalDashboard({
        issueListType: tab,
        q: q,
        status: status,
        sort: sort,
        onlyPledged,
      })

      signal?.addEventListener('abort', () => {
        promise.cancel()
      })

      return promise
    },
    {
      retry: defaultRetry,
    },
  )
