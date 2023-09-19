import type { Meta, StoryObj } from '@storybook/react'

import FundOnCompletion from './FundOnCompletion'

import { issue } from '../../stories/testdata'

const meta: Meta<typeof FundOnCompletion> = {
  title: 'Organisms/FundOnCompletion',
  component: FundOnCompletion,
  tags: ['autodocs'],
  parameters: {
    themes: ['light', 'dark'],
    nextjs: {
      appDirectory: true,
    },
  },
  render: (args) => (
    <div className="max-w-[400px]">
      <FundOnCompletion {...args} />
    </div>
  ),
}

export default meta

type Story = StoryObj<typeof FundOnCompletion>

export const Default: Story = {
  args: {
    issue: issue,
  },
}
