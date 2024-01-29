import type { Meta, StoryObj } from '@storybook/react'

import Topbar from '@/components/Shared/Topbar'

const meta: Meta<typeof Topbar> = {
  title: 'Organisms/Topbar',
  component: Topbar,
  tags: ['autodocs'],
}

export default meta

type Story = StoryObj<typeof Topbar>

export const Default: Story = {
  parameters: {
    chromatic: { viewports: [390, 1200] },
  },
}
