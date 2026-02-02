import { api } from '@/utils/client'
import { unwrap } from '@spaire/client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useListNotificationRecipients = () => {
  return useQuery({
    queryKey: ['notification_recipients'],
    queryFn: () => unwrap(api.GET('/v1/notifications/recipients')),
    retry: defaultRetry,
  })
}

export const useDeleteNotificationRecipient = () => {
  return useMutation({
    mutationFn: (variables: { notification_recipient_id: string }) =>
      api.DELETE('/v1/notifications/recipients/{id}', {
        params: {
          path: {
            id: variables.notification_recipient_id,
          },
        },
      }),
  })
}
