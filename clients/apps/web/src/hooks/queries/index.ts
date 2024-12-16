import { api, queryClient } from '@/utils/api'
import {
  ListResourceRepository,
  RepositoriesApiListRequest,
  ResponseError,
} from '@polar-sh/sdk'
import {
  UseMutationResult,
  UseQueryResult,
  useMutation,
  useQuery,
} from '@tanstack/react-query'
import { defaultRetry } from './retry'

export * from './accounts'
export * from './advertisements'
export * from './backoffice'
export * from './benefits'
export * from './checkout_links'
export * from './customerPortal'
export * from './customers'
export * from './customFields'
export * from './dashboard'
export * from './discord'
export * from './discounts'
export * from './files'
export * from './funding'
export * from './github'
export * from './githubRepositoryBenefit'
export * from './issue'
export * from './license_keys'
export * from './metrics'
export * from './org'
export * from './pledges'
export * from './products'
export * from './project'
export * from './rewards'
export * from './storefront'
export * from './subscriptions'
export * from './transactions'
export * from './user'
export * from './webhooks'

export const useListRepositories: (
  params?: RepositoriesApiListRequest,
  enabled?: boolean,
) => UseQueryResult<ListResourceRepository, ResponseError> = (
  params = {},
  enabled = true,
) =>
  useQuery({
    queryKey: ['repositories', { ...params }],
    queryFn: () => api.repositories.list({ ...params }),
    retry: defaultRetry,
    enabled,
  })

export const useAccount = (id?: string | null) =>
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
        body: {
          notification_id: variables.notification_id,
        },
      })
    },
    onSuccess: (_result, _variables, _ctx) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
