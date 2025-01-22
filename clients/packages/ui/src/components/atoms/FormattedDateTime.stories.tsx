import type { Meta, StoryObj } from '@storybook/react'
import { FormattedDateTime } from '.'

const meta: Meta<typeof FormattedDateTime> = {
  title: 'Atoms/FormattedDateTime',
  component: FormattedDateTime,
  tags: ['autodocs'],
}

export default meta

type Story = StoryObj<typeof FormattedDateTime>

export const Default: Story = {
  args: {
    datetime: new Date('2023-11-12'),
  },
}

export const DisplayTime: Story = {
  args: {
    datetime: new Date('2023-11-12'),
    displayTime: true,
  },
}
