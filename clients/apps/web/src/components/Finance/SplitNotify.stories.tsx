import { issue, pledgePublicAPI, user } from '@/utils/testdata'
import type { Meta, StoryObj } from '@storybook/react'
import SplitNotify from './SplitNotify'

const meta: Meta<typeof SplitNotify> = {
  title: 'Organisms/SplitNotify',
  component: SplitNotify,
  tags: ['autodocs'],
}

export default meta

type Story = StoryObj<typeof SplitNotify>

export const Default: Story = {
  args: {
    pledges: [pledgePublicAPI, pledgePublicAPI, pledgePublicAPI],
    splits: [
      {
        organization_id: 'XXXX',
        share_thousands: 200,
      },
      {
        github_username: 'foo',
        share_thousands: 400,
      },
      {
        github_username: 'bar',
        share_thousands: 400,
      },
    ],
    // onConfirm: () => {},
    onCancel: () => {},
    user: user,
    issue: issue,
  },
}

export const OneUser: Story = {
  args: {
    ...Default.args,
    splits: [
      {
        github_username: 'foo',
        share_thousands: 400,
      },
    ],
  },
}

export const ManyUsers: Story = {
  args: {
    ...Default.args,
    splits: [
      {
        github_username: 'one',
        share_thousands: 400,
      },
      {
        github_username: 'two',
        share_thousands: 400,
      },
      {
        github_username: 'three',
        share_thousands: 400,
      },
      {
        github_username: 'four',
        share_thousands: 400,
      },
      {
        github_username: 'five',
        share_thousands: 400,
      },
    ],
  },
}
