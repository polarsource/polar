import type { Meta, StoryObj } from '@storybook/react'

import OpenGraphImageCreator from '@/components/Organization/OpenGraphImageCreator'

const meta: Meta<typeof OpenGraphImageCreator> = {
  title: 'Organisms/OpenGraphImageCreator',
  component: OpenGraphImageCreator,
  parameters: {
    themes: ['light'],
  },
}

export default meta

type Story = StoryObj<typeof OpenGraphImageCreator>

export const Default: Story = {
  args: {
    organization: {
      id: '12313',
      platform: 'github',
      is_personal: false,
      pledge_minimum_amount: 0,
      pledge_badge_show_amount: false,
      has_app_installed: true,
      is_teams_enabled: false,
      name: 'polarsource',
      avatar_url: 'https://avatars.githubusercontent.com/u/68443778?v=4',
    },
  },
  render: (args) => {
    return (
      <div className="absolute">
        <OpenGraphImageCreator {...args} />
      </div>
    )
  },
}
