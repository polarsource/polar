import type { Meta, StoryObj } from '@storybook/react'

import { useState } from 'react'
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
  render: (args) => {
    const [checked, setChecked] = useState(args.checked)
    return <Switch id="" checked={checked} onChange={setChecked} />
  },
}

export const Unckecked: Story = {
  ...Checked,
  args: {
    checked: false,
  },
}
