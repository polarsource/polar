import { useNotifications, useNotificationsMarkRead } from '@/hooks/queries'
import BoltOutlined from '@mui/icons-material/BoltOutlined'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@polar-sh/ui/components/ui/popover'
import { useState } from 'react'
import { NotificationRow } from './NotificationRow'

export const NotificationsPopover = () => {
  const { data } = useNotifications()
  const markRead = useNotificationsMarkRead()
  const [open, setOpen] = useState(false)

  const notifications = data?.notifications ?? []
  const lastReadIndex = notifications.findIndex(
    (n) => n.id === data?.last_read_notification_id,
  )
  const unreadCount =
    lastReadIndex === -1 ? notifications.length : lastReadIndex
  const hasUnread = unreadCount > 0

  // Mark as read on close, so what was new stays marked while it's open.
  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next && hasUnread) {
      markRead.mutate({ notification_id: notifications[0].id })
    }
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <Button
        className="relative size-8! cursor-pointer p-0"
        variant="ghost"
        asChild
      >
        <PopoverTrigger
          aria-label="Notifications"
          className="flex size-full cursor-pointer items-center justify-center"
        >
          <BoltOutlined fontSize="small" aria-hidden="true" />
          {hasUnread && !open && (
            <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-blue-500" />
          )}
        </PopoverTrigger>
      </Button>
      <PopoverContent
        sideOffset={8}
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="w-[400px] overflow-hidden rounded-2xl p-0"
      >
        <Box flexDirection="column" maxHeight={560}>
          <Box
            alignItems="center"
            justifyContent="between"
            paddingHorizontal="l"
            paddingTop="l"
            paddingBottom="xs"
          >
            <Text variant="title" as="h2">
              Notification Inbox
            </Text>
            {notifications.length > 0 && (
              <Box alignItems="center" columnGap="s">
                <span
                  className={`size-1.5 rounded-full ${hasUnread ? 'bg-blue-500' : 'dark:bg-polar-600 bg-gray-300'}`}
                />
                <Text variant="caption" color="muted" tabularNums>
                  {unreadCount >= 100 ? '99+' : unreadCount} new
                </Text>
              </Box>
            )}
          </Box>
          <Box
            flexDirection="column"
            minHeight={0}
            overflowY="auto"
            paddingHorizontal="s"
            paddingVertical="s"
          >
            {notifications.length === 0 ? (
              <Box justifyContent="center" paddingVertical="3xl">
                <Text color="muted">You don&apos;t have any notifications</Text>
              </Box>
            ) : (
              <Box as="ul" flexDirection="column">
                {notifications.map((notification, index) => (
                  <NotificationRow
                    key={notification.id}
                    notification={notification}
                    unread={index < unreadCount}
                  />
                ))}
              </Box>
            )}
          </Box>
        </Box>
      </PopoverContent>
    </Popover>
  )
}

export default Popover
