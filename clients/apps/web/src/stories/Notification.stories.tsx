import type { Meta, StoryObj } from '@storybook/react'

import { PolarQueryClientProvider } from '@/app/providers'
import {
  addDays,
  notification_maintainerPledgeConfirmationPendingNotification,
  notification_maintainerPledgeCreatedNotification,
  notification_maintainerPledgePaidNotification,
  notification_maintainerPledgePendingNotification,
  notification_pledgerPledgePendingNotification,
  notification_rewardPaidNotification,
} from '@/utils/testdata'
import {
  MaintainerPledgeConfirmationPending,
  Notification,
} from '../components/Notifications/NotificationsPopover'

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
      canMarkSolved: false,
      isMarkedSolved: false,
      onMarkSoved: async () => {},
    },
    render: (args) => {
      return (
        <PolarQueryClientProvider>
          <MaintainerPledgeConfirmationPending {...args} />
        </PolarQueryClientProvider>
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
      id: 'x',
      created_at: new Date().toISOString(),
      type: 'MaintainerPledgedIssuePendingNotification',
      payload: {
        pledge_amount_sum: '123.50',
        issue_url: '#',
        issue_title: 'Hello World',
        issue_org_name: 'polarsource',
        issue_repo_name: 'polar',
        issue_number: 123,
        issue_id: 'xx',
        maintainer_has_account: false,
      },
    },
  },
}

export const MaintainerPledgedIssueConfirmationPendingNotificationItem: StoryConfirmationPending =
  {
    args: {
      n: {
        id: 'x',
        created_at: new Date().toISOString(),
        type: 'MaintainerPledgedIssueConfirmationPendingNotification',
        payload: {
          pledge_amount_sum: '123.50',
          issue_url: '#',
          issue_title: 'Hello World',
          issue_org_name: 'polarsource',
          issue_repo_name: 'polar',
          issue_number: 123,
          issue_id: 'xx',
          maintainer_has_account: false,
        },
      },
      canMarkSolved: false,
      isMarkedSolved: false,
      onMarkSoved: async () => {},
    },
    render: (args) => {
      return (
        <PolarQueryClientProvider>
          <MaintainerPledgeConfirmationPending {...args} />
        </PolarQueryClientProvider>
      )
    },
  }

export const TeamAdminMemberPledgedNotificationItem: Story = {
  args: {
    n: {
      id: 'x',
      created_at: addDays(new Date(), -2).toISOString(),
      type: 'TeamAdminMemberPledgedNotification',
      payload: {
        pledge_amount: '123.50',
        issue_url: '#',
        issue_title: 'Hello World',
        issue_org_name: 'polarsource',
        issue_repo_name: 'polar',
        issue_number: 123,
        team_member_name: 'zegl',
        team_name: 'polarsource',
        pledge_id: 'x',
      },
    },
  },
}
