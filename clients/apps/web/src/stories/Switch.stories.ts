import type { Meta, StoryObj } from '@storybook/react'

import { Switch } from '../components/UI/Switch'

// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta: Meta<typeof Switch> = {
  title: 'Switch',
  component: Switch,
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/react/writing-docs/autodocs
  tags: ['autodocs'],
  // More on argTypes: https://storybook.js.org/docs/react/api/argtypes
  argTypes: {
    checked: Boolean,
  },
}

export default meta

type Story = StoryObj<typeof Switch>

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
export const Checked: Story = {
  // More on args: https://storybook.js.org/docs/react/writing-stories/args
  args: {
    checked: true,
  },
}

export const Unckecked: Story = {
  args: {
    checked: false,
  },
}
