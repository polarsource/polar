import { useEffect, useState } from 'react'
import { useListNotifications } from './polar/notifications'

export const useNotificationsBadge = () => {
  const [showBadge, setShowBadge] = useState(false)

  const { data: notifications } = useListNotifications()

  useEffect(() => {
    const haveNotifications =
      notifications && notifications.notifications.length > 0
    const noReadNotifications =
      haveNotifications && !notifications.last_read_notification_id
    const lastNotificationIsUnread =
      haveNotifications &&
      notifications.last_read_notification_id !==
        notifications.notifications[0].id

    const showBadge = !!(
      haveNotifications &&
      (noReadNotifications || lastNotificationIsUnread)
    )

    setShowBadge(showBadge)
  }, [notifications])

  return showBadge
}
