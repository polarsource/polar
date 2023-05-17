import type { Meta, StoryObj } from '@storybook/react'

import { CountryPicker } from 'polarkit/components'

const meta: Meta<typeof CountryPicker> = {
  title: 'Molecules/CountryPicker',
  component: CountryPicker,
}

export default meta

type Story = StoryObj<typeof CountryPicker>

export const Default: Story = {}
