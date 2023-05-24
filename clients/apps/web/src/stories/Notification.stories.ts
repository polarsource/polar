import type { Meta, StoryObj } from '@storybook/react'

import { Notification } from '../components/Notifications/Popover'
import {
  notification_maintainerPledgeCreatedNotification,
  notification_maintainerPledgePaidNotification,
  notification_maintainerPledgePendingNotification,
} from './testdata'

const meta: Meta<typeof Notification> = {
  title: 'Organisms/Notification',
  component: Notification,
  tags: ['autodocs'],
}

export default meta

type Story = StoryObj<typeof Notification>

export const MaintainerPledgeCreatedNotificationItem: Story = {
  args: {
    n: notification_maintainerPledgeCreatedNotification,
  },
}

export const MaintainerPledgePendingNotificationItem: Story = {
  args: {
    n: notification_maintainerPledgePendingNotification,
  },
}

export const MaintainerPledgePaidNotificationItem: Story = {
  args: {
    n: notification_maintainerPledgePaidNotification,
  },
}
