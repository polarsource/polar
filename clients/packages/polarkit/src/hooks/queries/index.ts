import { useMutation, useQuery, UseQueryResult } from '@tanstack/react-query'
import {
  ApiError,
  IssueSortBy,
  OrganizationSettingsUpdate,
  type OrganizationRead,
  type RepositoryRead,
  type UserRead,
} from 'polarkit/api/client'
import { api, queryClient } from '../../api'
import { IssueListResponse, IssueStatus, Platforms } from '../../api/client'
import { IssueListType } from '../../api/client/models/IssueListType'

export type RepoListItem = RepositoryRead & {
  organization: OrganizationRead
}

const defaultRetry = (failureCount: number, error: ApiError): boolean => {
  if (error.status === 404) {
    return false
  }
  if (failureCount > 2) {
    return false
  }
  return true
}

export const useUserOrganizations = (currentUser: UserRead | undefined) => {
  const userId = currentUser?.id
  const query = useQuery(
    ['user', 'organizations', userId],
    () => api.userOrganizations.getUserOrganizations(),
    {
      enabled: !!userId,
      retry: defaultRetry,
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
}

export const useOrganizationAccounts = (repoOwner: string) =>
  useQuery(
    ['organization', repoOwner, 'account'],
    () =>
      api.accounts.getAccount({
        platform: Platforms.GITHUB,
        orgName: repoOwner,
      }),
    { retry: defaultRetry },
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
      retry: defaultRetry,
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
      retry: defaultRetry,
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
      retry: defaultRetry,
    },
  )

export const useDashboard = (
  orgName: string,
  repoName?: string,
  tab?: IssueListType,
  q?: string,
  status?: Array<IssueStatus>,
  sort?: IssueSortBy,
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
      retry: defaultRetry,
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

export const useOrganizationCustomer = (orgName?: string) =>
  useQuery(
    ['organization', orgName, 'stripeCustomer'],
    () =>
      api.organizations.getStripeCustomer({
        platform: Platforms.GITHUB,
        orgName: orgName ?? '',
      }),
    {
      enabled: !!orgName,
      retry: defaultRetry,
    },
  )

export const useOrganizationCreateIntent = () =>
  useMutation({
    mutationFn: (variables: { orgName: string }) => {
      return api.organizations.createSetupIntent({
        platform: Platforms.GITHUB,
        orgName: variables.orgName,
      })
    },
  })

export const useOrganizationSetDefaultPaymentMethod = () =>
  useMutation({
    mutationFn: (variables: { orgName: string; paymentMethodId: string }) => {
      return api.organizations.setDefaultPaymentMethod({
        platform: Platforms.GITHUB,
        orgName: variables.orgName,
        paymentMethodId: variables.paymentMethodId,
      })
    },
    onSuccess: (result, variables, ctx) => {
      queryClient.setQueryData(
        ['organization', variables.orgName, 'stripeCustomer'],
        result,
      )
    },
  })

export const useNotifications = () =>
  useQuery(['notifications'], () => api.notifications.get(), {
    retry: defaultRetry,
  })
