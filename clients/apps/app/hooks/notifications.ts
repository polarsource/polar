import { useListNotifications } from './polar/notifications'

export const useNotificationsBadge = () => {
  const { data: notifications } = useListNotifications()
  const haveNotifications =
    notifications && notifications.notifications.length > 0
  const noReadNotifications =
    haveNotifications && !notifications.last_read_notification_id
  const lastNotificationIsUnread =
    haveNotifications &&
    notifications.last_read_notification_id !==
      notifications.notifications[0].id

  return !!(
    haveNotifications &&
    (noReadNotifications || lastNotificationIsUnread)
  )
}
