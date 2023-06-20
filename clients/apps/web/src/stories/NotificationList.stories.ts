import type { Meta, StoryObj } from '@storybook/react'

import { List } from '../components/Notifications/Popover'
import {
  notification_maintainerPledgeCreatedNotification,
  notification_maintainerPledgePaidNotification,
  notification_maintainerPledgePendingNotification,
  notification_pledgerPledgePendingNotification,
} from './testdata'

const meta: Meta<typeof List> = {
  title: 'Organisms/NotificationList',
  component: List,
  tags: ['autodocs'],
  parameters: {
    themeLayout: 'side-by-side',
  },
}

export default meta

type Story = StoryObj<typeof List>

export const Default: Story = {
  args: {
    notifications: [
      notification_maintainerPledgeCreatedNotification,
      notification_maintainerPledgePendingNotification,
      notification_maintainerPledgePaidNotification,
      notification_pledgerPledgePendingNotification,
    ],
  },
}
