import { ListResourceRepository, Platforms, ResponseError } from '@polar-sh/sdk'
import {
  UseMutationResult,
  UseQueryResult,
  useMutation,
  useQuery,
} from '@tanstack/react-query'
import { api, queryClient } from '../../api'
import { defaultRetry } from './retry'

export * from './accounts'
export * from './advertisements'
export * from './articles'
export * from './backoffice'
export * from './dashboard'
export * from './discord'
export * from './funding'
export * from './github'
export * from './issue'
export * from './org'
export * from './pledges'
export * from './rewards'
export * from './subscriptions'
export * from './traffic'
export * from './transactions'
export * from './user'
export * from './webhookNotifications'

export const useListRepositories: () => UseQueryResult<
  ListResourceRepository,
  ResponseError
> = () =>
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

export const useAccount = (id?: string) =>
  useQuery({
    queryKey: ['accounts', id],
    queryFn: () => api.accounts.get({ id: id as string }),
    enabled: !!id,
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
