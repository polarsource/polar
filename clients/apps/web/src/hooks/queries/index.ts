import { queryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { operations, unwrap } from '@polar-sh/client'
import { useMutation, useQuery } from '@tanstack/react-query'
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
export * from './githubRepositoryBenefit'
export * from './issue'
export * from './license_keys'
export * from './metrics'
export * from './org'
export * from './pledges'
export * from './products'
export * from './refunds'
export * from './rewards'
export * from './subscriptions'
export * from './transactions'
export * from './user'
export * from './webhooks'

export const useListRepositories = (
  params: operations['repositories:list']['parameters']['query'] = {},
  enabled: boolean = true,
) =>
  useQuery({
    queryKey: ['repositories', { ...params }],
    queryFn: () =>
      unwrap(api.GET('/v1/repositories/', { params: { query: params } })),
    retry: defaultRetry,
    enabled,
  })

export const useAccount = (id?: string | null) =>
  useQuery({
    queryKey: ['accounts', id],
    queryFn: () =>
      unwrap(
        api.GET('/v1/accounts/{id}', { params: { path: { id: id ?? '' } } }),
      ),
    enabled: !!id,
    retry: defaultRetry,
  })

export const useNotifications = () =>
  useQuery({
    queryKey: ['notifications'],
    queryFn: () => unwrap(api.GET('/v1/notifications')),
    retry: defaultRetry,
  })

export const useNotificationsMarkRead = () =>
  useMutation({
    mutationFn: (variables: { notification_id: string }) => {
      return api.POST('/v1/notifications/read', {
        body: {
          notification_id: variables.notification_id,
        },
      })
    },
    onSuccess: (result, _variables, _ctx) => {
      if (result.error) {
        return
      }
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
