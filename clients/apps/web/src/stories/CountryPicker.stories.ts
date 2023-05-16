import type { Meta, StoryObj } from '@storybook/react'

import { CountryPicker } from 'polarkit/components'

// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta: Meta<typeof CountryPicker> = {
  title: 'CountryPicker',
  component: CountryPicker,
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/react/writing-docs/autodocs
  tags: ['autodocs'],
  // More on argTypes: https://storybook.js.org/docs/react/api/argtypes
  argTypes: {
    // checked: Boolean,
  },
}

export default meta

type Story = StoryObj<typeof CountryPicker>

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
export const Primary: Story = {
  // More on args: https://storybook.js.org/docs/react/writing-stories/args
  args: {
    // checked: true,
  },
}
