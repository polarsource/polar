import {
  UseMutationResult,
  UseQueryResult,
  useMutation,
  useQuery,
} from '@tanstack/react-query'
import {
  ApiError,
  ListResource_Organization_,
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
export * from './issue'
export * from './pledges'
export * from './rewards'
export * from './settings'
export * from './user'

export const useListOrganizations: () => UseQueryResult<
  ListResource_Organization_,
  ApiError
> = () =>
  useQuery({
    queryKey: ['user', 'organizations'],
    queryFn: () => api.organizations.list(),
    retry: defaultRetry,
  })

export const useListRepositories = () =>
  useQuery({
    queryKey: ['user', 'repositories'],
    queryFn: () => api.repositories.list(),
    retry: defaultRetry,
  })

export const useSearchRepositories = (
  platform: Platforms,
  organizationName: string,
) =>
  useQuery({
    queryKey: ['user', 'repositories', platform, organizationName],
    queryFn: () =>
      api.repositories.search({
        platform: platform,
        organizationName: organizationName,
      }),

    retry: defaultRetry,
  })

export const useListAccountsByOrganization = (organization_id?: string) =>
  useQuery({
    queryKey: ['accounts', organization_id],
    queryFn: () =>
      api.accounts.search({
        organizationId: organization_id,
      }),

    enabled: !!organization_id,
    retry: defaultRetry,
  })

export const useListAccountsByUser = (user_id?: string) =>
  useQuery({
    queryKey: ['accounts', user_id],
    queryFn: () =>
      api.accounts.search({
        userId: user_id,
      }),

    enabled: !!user_id,
    retry: defaultRetry,
  })

export const useOrganization = (orgName: string) =>
  useQuery({
    queryKey: ['organization', orgName],
    queryFn: () =>
      api.organizations.getInternal({
        platform: Platforms.GITHUB,
        orgName: orgName,
      }),

    enabled: !!orgName,
    retry: defaultRetry,
  })

export const useOrganizationSettingsMutation: () => UseMutationResult<
  OrganizationPrivateRead,
  Error,
  {
    orgName: string
    body: OrganizationSettingsUpdate
  },
  unknown
> = () =>
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
  useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.notifications.get(),
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
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
