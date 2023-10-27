import type { Meta, StoryObj } from '@storybook/react'

import PledgeCheckoutContribute from './PledgeCheckoutContribute'

import { issue } from 'polarkit/testdata'

const meta: Meta<typeof PledgeCheckoutContribute> = {
  title: 'Organisms/PledgeCheckoutContribute',
  component: PledgeCheckoutContribute,
  tags: ['autodocs'],
  parameters: {
    themes: ['light', 'dark'],
    nextjs: {
      appDirectory: true,
    },
  },
  render: (args) => (
    <div className="max-w-[350px]">
      <PledgeCheckoutContribute {...args} />
    </div>
  ),
}

export default meta

type Story = StoryObj<typeof PledgeCheckoutContribute>

export const Default: Story = {
  args: {
    issue: issue,
  },
}
