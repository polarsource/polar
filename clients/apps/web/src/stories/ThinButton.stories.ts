import type { Meta, StoryObj } from '@storybook/react'

import { ThinButton } from 'polarkit/components/ui/atoms'

const meta: Meta<typeof ThinButton> = {
  title: 'Atoms/ThinButton',
  component: ThinButton,
  tags: ['autodocs'],
}

export default meta

type Story = StoryObj<typeof ThinButton>

export const Primary: Story = {
  args: {
    children: 'Click me',
  },
}

export const PrimarySkinny: Story = {
  args: {
    children: 'Click me',
    fullWidth: false,
  },
}

export const PrimaryLoading: Story = {
  args: {
    children: 'Click me',
    loading: true,
  },
}

export const PrimaryDisabled: Story = {
  args: {
    children: 'Click me',
    disabled: true,
  },
}

export const Blue: Story = {
  args: {
    children: 'Click me',
    color: 'blue',
  },
}

export const Red: Story = {
  args: {
    children: 'Click me',
    color: 'red',
  },
}

export const Green: Story = {
  args: {
    children: 'Click me',
    color: 'green',
  },
}

export const Gray: Story = {
  args: {
    children: 'Click me',
    color: 'gray',
  },
}

export const Lightblue: Story = {
  args: {
    children: 'Click me',
    color: 'lightblue',
  },
}
