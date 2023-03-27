import { useMutation, useQuery, UseQueryResult } from '@tanstack/react-query'
import {
  OrganizationSettingsUpdate,
  type OrganizationRead,
  type RepositoryRead,
} from 'polarkit/api/client'
import { api, queryClient } from '../../api'
import { IssueListResponse, IssueStatus, Platforms } from '../../api/client'

export type RepoListItem = RepositoryRead & {
  organization: OrganizationRead
}

export const useUserOrganizations = (userId: string) => {
  const query = useQuery(
    ['user', 'organizations', userId],
    () => api.userOrganizations.getUserOrganizations(),
    {
      enabled: !!userId,
    },
  )

  let repositories: RepoListItem[] | undefined
  if (query.isSuccess) {
    const organizations = query.data
    repositories = organizations
      .map((org) => {
        return (
          org?.repositories?.map((repo) => {
            return {
              ...repo,
              organization: org,
            }
          }) || []
        )
      })
      .flat()
  }

  return {
    ...query,
    repositories,
    findBySlug: (orgSlug: string, repoSlug: string) => {
      if (!repositories) return undefined

      return repositories.find(
        (repo) => repo.organization.name === orgSlug && repo.name === repoSlug,
      )
    },
  }
  return query
}

export const useOrganizationAccounts = (repoOwner: string) =>
  useQuery(['organization', repoOwner, 'account'], () =>
    api.accounts.getAccount({
      platform: Platforms.GITHUB,
      orgName: repoOwner,
    }),
  )

export const useRepositoryIssues = (repoOwner: string, repoName: string) =>
  useQuery(
    ['issues', 'repo', repoOwner, repoName],
    () =>
      api.issues.getRepositoryIssues({
        platform: Platforms.GITHUB,
        orgName: repoOwner,
        repoName: repoName,
      }),
    {
      enabled: !!repoOwner && !!repoName,
    },
  )

export const useRepositoryPullRequests = (
  repoOwner: string,
  repoName: string,
) =>
  useQuery(
    ['pull_requests', 'repo', repoOwner, repoName],
    () =>
      api.pullRequests.getRepositoryPullRequests({
        platform: Platforms.GITHUB,
        orgName: repoOwner,
        repoName: repoName,
      }),
    {
      enabled: !!repoOwner && !!repoName,
    },
  )

export const useRepositoryPledges = (repoOwner: string, repoName: string) =>
  useQuery(
    ['pledges', 'repo', repoOwner, repoName],
    () =>
      api.pledges.getRepositoryPledges({
        platform: Platforms.GITHUB,
        orgName: repoOwner,
        repoName: repoName,
      }),
    {
      enabled: !!repoOwner && !!repoName,
    },
  )

export const useDashboard = (
  orgName: string,
  repoName?: string,
  q?: string,
  status?: Array<IssueStatus>,
): UseQueryResult<IssueListResponse> =>
  useQuery(
    [
      'dashboard',
      'repo',
      orgName,
      repoName,
      q,
      JSON.stringify(status), // Array as cache key
    ],
    ({ signal }) => {
      const promise = api.dashboard.getDashboard({
        platform: Platforms.GITHUB,
        orgName: orgName,
        repoName: repoName,
        q: q,
        status: status,
      })

      signal?.addEventListener('abort', () => {
        promise.cancel()
      })

      return promise
    },
    {
      enabled: !!orgName,
    },
  )

export const useOrganization = (orgName: string) =>
  useQuery(
    ['organization', orgName],
    () =>
      api.organizations.get({
        platform: Platforms.GITHUB,
        orgName: orgName,
      }),
    {
      enabled: !!orgName,
    },
  )

export const useOrganizationSettingsMutation = () =>
  useMutation({
    mutationFn: (variables: {
      orgName: string
      body: OrganizationSettingsUpdate
    }) => {
      return api.organizations.updateSettings({
        platform: Platforms.GITHUB,
        orgName: variables.orgName,
        requestBody: variables.body,
      })
    },
    onSuccess: (result, variables, ctx) => {
      queryClient.setQueryData(['organization', variables.orgName], result)
    },
  })
