import { useMutation, useQuery } from '@tanstack/react-query'
import {
  OrganizationPrivateRead,
  OrganizationSettingsUpdate,
  type RepositoryRead,
  type UserRead,
} from 'polarkit/api/client'
import { api, queryClient } from '../../api'
import { Platforms } from '../../api/client'
import { defaultRetry } from './retry'

export type RepoListItem = RepositoryRead & {
  organization: OrganizationPrivateRead
}

export * from './backoffice'
export * from './dashboard'
export * from './invite'
export * from './issue'
export * from './pledges'
export * from './settings'
export * from './user'

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

export const useOrganizationAccounts = (repoOwner: string | undefined) =>
  useQuery(
    ['organization', repoOwner, 'account'],
    () =>
      api.accounts.getAccount({
        platform: Platforms.GITHUB,
        orgName: repoOwner || '',
      }),
    {
      enabled: !!repoOwner,
      retry: defaultRetry,
    },
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

export const useNotifications = () =>
  useQuery(['notifications'], () => api.notifications.get(), {
    retry: defaultRetry,
  })

export const useNotificationsMarkRead = () =>
  useMutation({
    mutationFn: (variables: { notification_id: string }) => {
      return api.notifications.markRead({
        requestBody: {
          notification_id: variables.notification_id,
        },
      })
    },
    onSuccess: (result, variables, ctx) => {
      queryClient.invalidateQueries(['notifications'])
    },
  })
