import type { Meta, StoryObj } from '@storybook/react'

import {
  MaintainerPledgeConfirmationPending,
  Notification,
} from '../components/Notifications/Popover'
import {
  notification_maintainerPledgeConfirmationPendingNotification,
  notification_maintainerPledgeCreatedNotification,
  notification_maintainerPledgePaidNotification,
  notification_maintainerPledgePendingNotification,
  notification_pledgerPledgePendingNotification,
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

export const PledgerPledgePendingNotificationItem: Story = {
  args: {
    n: notification_pledgerPledgePendingNotification,
  },
}

type StoryConfirmationPending = StoryObj<
  typeof MaintainerPledgeConfirmationPending
>

export const MaintainerPledgeConfirmationPendingNotificationItem: StoryConfirmationPending =
  {
    args: {
      n: notification_maintainerPledgeConfirmationPendingNotification,
    },
  }
