import type { Meta, StoryObj } from '@storybook/react'

import Box from '../components/Settings/Box'
import { NotificationSettingsBox } from '../components/Settings/NotificationSettings'

const meta: Meta<typeof NotificationSettingsBox> = {
  title: 'Organisms/NotificationSettings',
  component: NotificationSettingsBox,
  tags: ['autodocs'],
  args: {
    onUpdated: () => {},
    settings: {
      email_promotions_and_events: true,
    },
  },
}

export default meta

type Story = StoryObj<typeof NotificationSettingsBox>

export const Default: Story = {}

export const InBox: Story = {
  render: (args) => (
    <Box>
      <NotificationSettingsBox {...args} />
    </Box>
  ),
}

export const CanSave: Story = {
  args: {
    ...Default.args,
    canSave: true,
  },
  render: (args) => (
    <Box>
      <NotificationSettingsBox {...args} />
    </Box>
  ),
}
