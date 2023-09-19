import type { Meta, StoryObj } from '@storybook/react'

import Contribute from './Contribute'

import { issue } from '../../stories/testdata'

const meta: Meta<typeof Contribute> = {
  title: 'Organisms/Contribute',
  component: Contribute,
  tags: ['autodocs'],
  parameters: {
    themes: ['light', 'dark'],
    nextjs: {
      appDirectory: true,
    },
  },
  render: (args) => (
    <div className="max-w-[350px]">
      <Contribute {...args} />
    </div>
  ),
}

export default meta

type Story = StoryObj<typeof Contribute>

export const Default: Story = {
  args: {
    issue: issue,
  },
}
