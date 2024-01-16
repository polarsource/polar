import type { Meta, StoryObj } from '@storybook/react'
import { Pledgers } from 'polarkit/components/Issue'
import { pledger } from 'polarkit/testdata'

const meta: Meta<typeof Pledgers> = {
  title: 'Organisms/Pledgers',
  component: Pledgers,
  tags: ['autodocs'],
  args: {
    pledgers: Array(10)
      .fill(0)
      .map(() => pledger),
    size: 'md',
  },
}

export default meta

type Story = StoryObj<typeof Pledgers>

export const Default: Story = {}

export const OnePledger: Story = {
  args: {
    pledgers: [pledger],
  },
}

export const TwoPledgers: Story = {
  args: {
    pledgers: [pledger, pledger],
  },
}

export const PledgerWithoutAvatar: Story = {
  args: {
    pledgers: [pledger, { name: 'jdoe' }],
  },
}
