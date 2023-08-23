import type { Meta, StoryObj } from '@storybook/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from 'polarkit'
import PublicLayout from './PublicLayout'

const meta: Meta<typeof PublicLayout> = {
  title: 'Layouts/PublicLayout',
  component: PublicLayout,
}

export default meta

type Story = StoryObj<typeof PublicLayout>

export const Default: Story = {
  parameters: {
    themes: ['light'],
    padding: 'p-0 m-0',
  },
  render: (args) => (
    <QueryClientProvider client={queryClient}>
      <PublicLayout {...args}>
        <div className="bg-red-200 text-black">Content</div>
      </PublicLayout>
    </QueryClientProvider>
  ),
}

export const Dark: Story = {
  ...Default,
  parameters: {
    themes: ['dark'],
    padding: 'p-0',
  },
}
