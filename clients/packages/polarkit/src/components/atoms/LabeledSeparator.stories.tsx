import type { Meta, StoryObj } from '@storybook/react'
import { LabeledSeparator } from '.'

const meta: Meta<typeof LabeledSeparator> = {
  title: 'Atoms/LabeledSeparator',
  component: LabeledSeparator,
}

export default meta

type Story = StoryObj<typeof LabeledSeparator>

export const Default: Story = {
  args: {
    label: 'Or',
  },
  render: (args) => {
    return <LabeledSeparator {...args} />
  },
}
