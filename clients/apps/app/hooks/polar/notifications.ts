import { usePolarClient } from '@/providers/PolarClientProvider'
import { useSession } from '@/providers/SessionProvider'
import { queryClient } from '@/utils/query'
import { unwrap } from '@polar-sh/client'
import { useMutation, useQuery, UseQueryResult } from '@tanstack/react-query'
import { Platform } from 'react-native'

export interface NotificationRecipient {
  id: string
  expo_push_token: string
  platform: 'ios' | 'android'
  created_at: string
  updated_at: string
}

export const useCreateNotificationRecipient = () => {
  const { polar } = usePolarClient()

  return useMutation({
    mutationFn: async (expoPushToken: string) => {
      return unwrap(
        polar.POST('/v1/notifications/recipients', {
          body: {
            expo_push_token: expoPushToken,
            platform: Platform.OS as 'ios' | 'android',
          },
        }),
      )
    },
    onSuccess: (result, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['notification_recipient'] })
      queryClient.invalidateQueries({ queryKey: ['notification_recipients'] })
    },
  })
}

export const useListNotificationRecipients = () => {
  const { polar } = usePolarClient()

  return useQuery({
    queryKey: ['notification_recipients'],
    queryFn: async () => {
      return unwrap(polar.GET('/v1/notifications/recipients'))
    },
  })
}

export const useGetNotificationRecipient = (
  expoPushToken: string | undefined,
) => {
  const { session } = useSession()
  const { polar } = usePolarClient()

  return useQuery({
    queryKey: ['notification_recipient', expoPushToken],
    queryFn: async () => {
      const response = await unwrap(
        polar.GET('/v1/notifications/recipients', {
          params: {
            query: {
              expo_push_token: expoPushToken,
            },
          },
        }),
      )

      return response.items?.[0] ?? null
    },
    enabled: !!expoPushToken && !!session,
  })
}

export const useDeleteNotificationRecipient = () => {
  const { polar } = usePolarClient()

  return useMutation({
    mutationFn: async (id: string) => {
      return polar
        .DELETE('/v1/notifications/recipients/{id}', {
          params: {
            path: {
              id,
            },
          },
        })
        .finally(() => {
          queryClient.invalidateQueries({
            queryKey: ['notification_recipients'],
          })
          queryClient.invalidateQueries({
            queryKey: ['notification_recipient'],
          })
        })
    },
  })
}

export type MaintainerAccountUnderReviewNotificationPayload = {
  account_type: string
}

export type MaintainerAccountReviewedNotificationPayload = {
  account_type: string
}

export type MaintainerCreateAccountNotificationPayload = {
  organization_name: string
  url: string
}

export type MaintainerNewPaidSubscriptionNotificationPayload = {
  subscriber_name: string
  tier_name: string
  tier_price_amount: number | null
  tier_price_recurring_interval: string
  tier_organization_name: string
}

export type MaintainerNewProductSaleNotificationPayload = {
  customer_name: string
  product_name: string
  product_price_amount: number
  organization_name: string
}

export type Notification = {
  id: string
  created_at: string
  type:
    | 'MaintainerAccountUnderReview'
    | 'MaintainerAccountReviewed'
    | 'MaintainerCreateAccount'
    | 'MaintainerNewPaidSubscription'
    | 'MaintainerNewProductSale'
  payload:
    | MaintainerAccountUnderReviewNotificationPayload
    | MaintainerAccountReviewedNotificationPayload
    | MaintainerCreateAccountNotificationPayload
    | MaintainerNewPaidSubscriptionNotificationPayload
    | MaintainerNewProductSaleNotificationPayload
}

export const useListNotifications = (): UseQueryResult<
  {
    notifications: Notification[]
    last_read_notification_id: string
  },
  Error
> => {
  const { session } = useSession()

  return useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_POLAR_SERVER_URL}/v1/notifications`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session}`,
          },
        },
      )

      return response.json()
    },
  })
}

export const useNotificationsMarkRead = () => {
  const { session } = useSession()

  return useMutation({
    mutationFn: async (variables: { notificationId: string }) => {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_POLAR_SERVER_URL}/v1/notifications/read`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session}`,
          },
          body: JSON.stringify({
            notification_id: variables.notificationId,
          }),
        },
      )

      return response.json()
    },
    onSuccess: (result, _variables, _ctx) => {
      if (result && 'error' in result && result.error) {
        return
      }

      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}
