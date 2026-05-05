import { usePolarClient } from '@/providers/PolarClientProvider'
import { useSession } from '@/providers/SessionProvider'
import { queryClient } from '@/utils/query'
import { schemas, unwrap } from '@polar-sh/client'
import { useMutation, useQuery, UseQueryResult } from '@tanstack/react-query'
import { Platform } from 'react-native'

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
    throwOnError: false,
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

export type Notification = schemas['NotificationsList']['notifications'][number]

export type MaintainerCreateAccountNotificationPayload =
  schemas['MaintainerCreateAccountNotificationPayload']
export type MaintainerNewPaidSubscriptionNotificationPayload =
  schemas['MaintainerNewPaidSubscriptionNotificationPayload']
export type MaintainerNewProductSaleNotificationPayload =
  schemas['MaintainerNewProductSaleNotificationPayload']
export type MaintainerAccountCreditsGrantedNotificationPayload =
  schemas['MaintainerAccountCreditsGrantedNotificationPayload']

export const useListNotifications = (): UseQueryResult<
  schemas['NotificationsList'],
  Error
> => {
  const { session } = useSession()

  return useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_POLAR_SERVER_URL ?? 'https://api.polar.sh'}/v1/notifications`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session}`,
          },
        },
      )

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      return response.json()
    },
  })
}

export const useNotificationsMarkRead = () => {
  const { session } = useSession()

  return useMutation({
    mutationFn: async (variables: { notificationId: string }) => {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_POLAR_SERVER_URL ?? 'https://api.polar.sh'}/v1/notifications/read`,
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

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
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
