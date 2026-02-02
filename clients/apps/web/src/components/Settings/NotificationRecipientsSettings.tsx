'use client'

import { useListNotificationRecipients } from '@/hooks/queries/notifications'
import { schemas } from '@spaire/client'
import ShadowListGroup from '@spaire/ui/components/atoms/ShadowListGroup'

const NotificationRecipientItem = ({
  recipient,
}: {
  recipient: schemas['NotificationRecipientSchema']
}) => {
  return (
    <div className="flex flex-col gap-y-2">
      <span className="font-medium">{recipient.platform} Device</span>
      <span className="dark:text-polar-500 font-mono text-xs text-gray-500">
        {recipient.expo_push_token}
      </span>
    </div>
  )
}

export const NotificationRecipientsSettings = () => {
  const { data: notificationRecipients } = useListNotificationRecipients()

  return (
    <ShadowListGroup>
      {notificationRecipients?.items &&
      notificationRecipients.items.length > 0 ? (
        notificationRecipients.items.map((recipient) => {
          return (
            <ShadowListGroup.Item key={recipient.id}>
              <NotificationRecipientItem recipient={recipient} />
            </ShadowListGroup.Item>
          )
        })
      ) : (
        <ShadowListGroup.Item>
          <p className="dark:text-polar-500 text-sm text-gray-500">
            You don&apos;t have any active Notification Recipients.
          </p>
        </ShadowListGroup.Item>
      )}
    </ShadowListGroup>
  )
}
