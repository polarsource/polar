import {
  UseMutationResult,
  UseQueryResult,
  useMutation,
  useQuery,
} from '@tanstack/react-query'
import {
  ListResourceOrganization,
  OrganizationBadgeSettingsUpdate,
  OrganizationPrivateRead,
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
export * from './user'

export const useListOrganizations: () => UseQueryResult<ListResourceOrganization> =
  () =>
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

export const useNotifications = () =>
  useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.notifications.get(),
    retry: defaultRetry,
  })

export const useNotificationsMarkRead: () => UseMutationResult<
  any,
  Error,
  {
    notification_id: string
  },
  unknown
> = () =>
  useMutation({
    mutationFn: (variables: { notification_id: string }) => {
      return api.notifications.markRead({
        notificationsMarkRead: {
          notification_id: variables.notification_id,
        },
      })
    },
    onSuccess: (result, variables, ctx) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

export const useOrganizationBadgeSettings = (id: string) =>
  useQuery({
    queryKey: ['organizationBadgeSettings', id],
    queryFn: () => api.organizations.getBadgeSettings({ id }),
    retry: defaultRetry,
  })

export const useUpdateOrganizationBadgeSettings = () =>
  useMutation({
    mutationFn: (variables: {
      id: string
      settings: OrganizationBadgeSettingsUpdate
    }) => {
      return api.organizations.updateBadgeSettings({
        id: variables.id,
        organizationBadgeSettingsUpdate: variables.settings,
      })
    },
    onSuccess: (result, variables, ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['organizationBadgeSettings', variables.id],
      })
    },
  })
