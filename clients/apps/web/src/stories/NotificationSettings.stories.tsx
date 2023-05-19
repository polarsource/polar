import type { Meta, StoryObj } from '@storybook/react'

import Box from '../components/Settings/Box'
import NotificationSettings from '../components/Settings/NotificationSettings'

const meta: Meta<typeof NotificationSettings> = {
  title: 'Organisms/NotificationSettings',
  component: NotificationSettings,
  tags: ['autodocs'],
  args: {
    orgName: 'polarsource',
    onUpdated: () => {},
    settings: {
      email_notification_maintainer_pull_request_created: true,
      email_notification_maintainer_pull_request_merged: true,
    },
  },
}

export default meta

type Story = StoryObj<typeof NotificationSettings>

export const Default: Story = {}

export const InBox: Story = {
  render: (args) => (
    <Box>
      <NotificationSettings {...args} />
    </Box>
  ),
}
