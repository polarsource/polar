import { getQueryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { unwrap } from '@polar-sh/client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export * from './accounts'
export * from './benefits'
export * from './checkout_links'
export * from './customerPortal'
export * from './customers'
export * from './customFields'
export * from './discord'
export * from './discounts'
export * from './files'
export * from './githubRepositoryBenefit'
export * from './license_keys'
export * from './metrics'
export * from './org'
export * from './products'
export * from './refunds'
export * from './seats'
export * from './subscriptions'
export * from './transactions'
export * from './user'
export * from './wallets'
export * from './webhooks'

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
      getQueryClient().invalidateQueries({ queryKey: ['notifications'] })
    },
  })
