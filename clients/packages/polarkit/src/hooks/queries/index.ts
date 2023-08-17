import { useMutation, useQuery } from '@tanstack/react-query'
import {
  OrganizationPrivateRead,
  OrganizationSettingsUpdate,
  Repository,
} from 'polarkit/api/client'
import { api, queryClient } from '../../api'
import { Platforms } from '../../api/client'
import { defaultRetry } from './retry'

export type RepoListItem = Repository & {
  organization: OrganizationPrivateRead
}

export * from './backoffice'
export * from './dashboard'
export * from './invite'
export * from './issue'
export * from './pledges'
export * from './rewards'
export * from './settings'
export * from './user'

export const useListOrganizations = () =>
  useQuery(['user', 'organizations'], () => api.organizations.list(), {
    retry: defaultRetry,
  })

export const useListRepositories = () =>
  useQuery(['user', 'repositories'], () => api.repositories.list(), {
    retry: defaultRetry,
  })

export const useSearchRepositories = (
  platform: Platforms,
  organizationName: string,
) =>
  useQuery(
    ['user', 'repositories', platform, organizationName],
    () =>
      api.repositories.search({
        platform: platform,
        organizationName: organizationName,
      }),
    {
      retry: defaultRetry,
    },
  )

export const useListAccountsByOrganization = (organization_id?: string) =>
  useQuery(
    ['accounts', organization_id],
    () =>
      api.accounts.search({
        organizationId: organization_id,
      }),
    {
      enabled: !!organization_id,
      retry: defaultRetry,
    },
  )

export const useListAccountsByUser = (user_id?: string) =>
  useQuery(
    ['accounts', user_id],
    () =>
      api.accounts.search({
        userId: user_id,
      }),
    {
      enabled: !!user_id,
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
      api.organizations.getInternal({
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
