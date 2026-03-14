'use client'

import { useListNotificationRecipients } from '@/hooks/queries/notifications'
import { schemas } from '@polar-sh/client'
import ListGroup from '@polar-sh/ui/components/atoms/ListGroup'

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
    <ListGroup>
      {notificationRecipients?.items &&
      notificationRecipients.items.length > 0 ? (
        notificationRecipients.items.map((recipient) => {
          return (
            <ListGroup.Item key={recipient.id}>
              <NotificationRecipientItem recipient={recipient} />
            </ListGroup.Item>
          )
        })
      ) : (
        <ListGroup.Item>
          <p className="dark:text-polar-500 text-sm text-gray-500">
            You don&apos;t have any active Notification Recipients.
          </p>
        </ListGroup.Item>
      )}
    </ListGroup>
  )
}
