import { getQueryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { unwrap } from '@polar-sh/client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export * from './accounts'
export * from './benefits'
export * from './checkout_links'
export * from './customers'
export * from './customFields'
export * from './discord'
export * from './discounts'
export * from './files'
export * from './githubRepositoryBenefit'
export * from './license_keys'
export * from './members'
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
    onSuccess: (result) => {
      if (result.error) {
        return
      }
      getQueryClient().invalidateQueries({ queryKey: ['notifications'] })
    },
  })
