import type { Meta, StoryObj } from '@storybook/react'

import { Switch } from '../components/UI/Switch'

const meta: Meta<typeof Switch> = {
  title: 'Atoms/Switch',
  component: Switch,
  tags: ['autodocs'],
  argTypes: {
    checked: Boolean,
  },
}

export default meta

type Story = StoryObj<typeof Switch>

export const Checked: Story = {
  args: {
    checked: true,
  },
}

export const Unckecked: Story = {
  args: {
    checked: false,
  },
}
