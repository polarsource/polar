import type { Meta, StoryObj } from '@storybook/react'

import OpenGraphImageCreator from '@/components/Organization/OpenGraphImageCreator'
import { org } from 'polarkit/testdata'

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
      ...org,
      id: '12313',
      platform: 'github',
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
