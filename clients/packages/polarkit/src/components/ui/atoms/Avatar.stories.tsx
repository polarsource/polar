import type { Meta, StoryObj } from '@storybook/react'
import Avatar from './Avatar'

const meta: Meta<typeof Avatar> = {
  title: 'Atoms/Avatar',
  component: Avatar,
  tags: ['autodocs'],
}

export default meta

type Story = StoryObj<typeof Avatar>

export const Initials: Story = {
  args: {
    name: 'Aaaa Bbbb Cccc',
  },
}

export const Image: Story = {
  args: {
    avatar_url: 'https://avatars.githubusercontent.com/u/1144727?v=4',
    name: 'Aaaa Bbbb Cccc',
  },
}
