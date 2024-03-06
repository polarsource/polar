import type { Meta, StoryObj } from '@storybook/react'
import { Button } from '../atoms/Button'
import Banner from './Banner'

const meta: Meta<typeof Banner> = {
  title: 'Atoms/Banner',
  component: Banner,
  tags: ['autodocs'],
}

export default meta

type Story = StoryObj<typeof Banner>

export const Default: Story = {
  args: {
    children: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    color: 'default',
  },
}

export const ColorMuted: Story = {
  args: {
    children: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    color: 'muted',
  },
}

export const ColorRed: Story = {
  args: {
    children: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    color: 'red',
  },
}

export const WithButton: Story = {
  args: {
    children: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    color: 'default',
    right: (
      <Button size="sm">
        <span>Click me</span>
      </Button>
    ),
  },
}
