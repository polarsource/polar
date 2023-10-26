import type { Meta, StoryObj } from '@storybook/react'

import { FaceOutlined } from '@mui/icons-material'
import Button from './Button'

const meta: Meta<typeof Button> = {
  title: 'Atoms/Button',
  component: Button,
  tags: ['autodocs'],
}

export default meta

type Story = StoryObj<typeof Button>

export const Default: Story = {
  args: {
    children: 'Click me',
    size: 'default',
  },
}

export const DefaultWithIcon: Story = {
  args: {
    children: <FaceOutlined fontSize="small" />,
    size: 'icon',
  },
}

export const DefaultDisabled: Story = {
  args: {
    children: 'Click me',
    disabled: true,
    size: 'default',
  },
}

export const Destructive: Story = {
  args: {
    children: 'Click me',
    variant: 'destructive',
    size: 'default',
  },
}

export const DestructiveDisabled: Story = {
  args: {
    children: 'Click me',
    variant: 'destructive',
    disabled: true,
    size: 'default',
  },
}

export const Outlined: Story = {
  args: {
    children: 'Click me',
    variant: 'outline',
    size: 'default',
  },
}

export const OutlinedDisabled: Story = {
  args: {
    children: 'Click me',
    variant: 'outline',
    disabled: true,
    size: 'default',
  },
}

export const Secondary: Story = {
  args: {
    children: 'Click me',
    variant: 'secondary',
    size: 'default',
  },
}

export const SecondaryDisabled: Story = {
  args: {
    children: 'Click me',
    variant: 'secondary',
    disabled: true,
    size: 'default',
  },
}

export const Ghost: Story = {
  args: {
    children: 'Click me',
    variant: 'ghost',
    size: 'default',
  },
}

export const GhostDisabled: Story = {
  args: {
    children: 'Click me',
    variant: 'ghost',
    disabled: true,
    size: 'default',
  },
}

export const Link: Story = {
  args: {
    children: 'Click me',
    variant: 'link',
    size: 'default',
  },
}

export const LinkDisabled: Story = {
  args: {
    children: 'Click me',
    variant: 'link',
    disabled: true,
    size: 'default',
  },
}
