import type { Meta, StoryObj } from '@storybook/react'

import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from 'polarkit'
import {
  MaintainerPledgedIssueConfirmationPendingNotification,
  MaintainerPledgedIssuePendingNotification,
  NotificationType,
} from 'polarkit/api/client'
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
  notification_rewardPaidNotification,
} from './testdata'

const meta: Meta<typeof Notification> = {
  title: 'Organisms/Notification',
  component: Notification,
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
      payload:
        notification_maintainerPledgeConfirmationPendingNotification.payload,
      canMarkSolved: false,
      isMarkedSolved: false,
      onMarkSoved: async () => {},
    },
    render: (args) => {
      return (
        <QueryClientProvider client={queryClient}>
          <MaintainerPledgeConfirmationPending {...args} />
        </QueryClientProvider>
      )
    },
  }

export const MaintainerPledgeConfirmationPendingNotificationItemCanSolve: StoryConfirmationPending =
  {
    ...MaintainerPledgeConfirmationPendingNotificationItem,
    args: {
      ...MaintainerPledgeConfirmationPendingNotificationItem.args,
      canMarkSolved: true,
    },
  }

export const MaintainerPledgeConfirmationPendingNotificationItemLoading: StoryConfirmationPending =
  {
    ...MaintainerPledgeConfirmationPendingNotificationItem,
    args: {
      ...MaintainerPledgeConfirmationPendingNotificationItem.args,
      canMarkSolved: true,
      isLoading: true,
    },
  }

export const RewardPaidNotificationItem: Story = {
  args: {
    n: notification_rewardPaidNotification,
  },
}

export const MaintainerPledgedIssuePendingNotificationItem: Story = {
  args: {
    n: {
      ...notification_maintainerPledgeCreatedNotification,
      type: NotificationType.MAINTAINER_PLEDGED_ISSUE_PENDING_NOTIFICATION,
      payload: {
        pledge_amount_sum: '123.50',
        issue_url: '#',
        issue_title: 'Hello World',
        issue_org_name: 'polarsource',
        issue_repo_name: 'polar',
        issue_number: 123,
        issue_id: 'xx',
        maintainer_has_account: false,
      } as MaintainerPledgedIssuePendingNotification,
    },
  },
}

export const MaintainerPledgedIssueConfirmationPendingNotificationItem: StoryConfirmationPending =
  {
    args: {
      n: {
        ...notification_maintainerPledgeCreatedNotification,
        type: NotificationType.MAINTAINER_PLEDGED_ISSUE_CONFIRMATION_PENDING_NOTIFICATION,
        payload: {
          pledge_amount_sum: '123.50',
          issue_url: '#',
          issue_title: 'Hello World',
          issue_org_name: 'polarsource',
          issue_repo_name: 'polar',
          issue_number: 123,
          issue_id: 'xx',
          maintainer_has_account: false,
        } as MaintainerPledgedIssueConfirmationPendingNotification,
      },
      payload: {
        pledge_amount_sum: '123.50',
        issue_url: '#',
        issue_title: 'Hello World',
        issue_org_name: 'polarsource',
        issue_repo_name: 'polar',
        issue_number: 123,
        issue_id: 'xx',
        maintainer_has_account: false,
      } as MaintainerPledgedIssueConfirmationPendingNotification,
      canMarkSolved: false,
      isMarkedSolved: false,
      onMarkSoved: async () => {},
    },
    render: (args) => {
      return (
        <QueryClientProvider client={queryClient}>
          <MaintainerPledgeConfirmationPending {...args} />
        </QueryClientProvider>
      )
    },
  }
