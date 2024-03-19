import type { Meta, StoryObj } from '@storybook/react'
import Alert from './Alert'

const meta: Meta<typeof Alert> = {
  title: 'Atoms/Alert',
  component: Alert,
  render: (args) => {
    return <Alert {...args}>This is an alert message!</Alert>
  },
  tags: ['autodocs'],
}

export default meta

type Story = StoryObj<typeof Alert>

export const Blue: Story = {
  args: {
    color: 'blue',
  },
}

export const Gray: Story = {
  args: {
    color: 'gray',
  },
}

export const Red: Story = {
  args: {
    color: 'red',
  },
}

export const Green: Story = {
  args: {
    color: 'green',
  },
}
