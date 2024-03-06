import type { Meta, StoryObj } from '@storybook/react'
import CountryPicker from './CountryPicker'

const meta: Meta<typeof CountryPicker> = {
  title: 'Atoms/CountryPicker',
  component: CountryPicker,
}

export default meta

type Story = StoryObj<typeof CountryPicker>

export const Default: Story = {
  args: {},
}
