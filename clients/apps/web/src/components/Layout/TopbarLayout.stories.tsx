import type { Meta, StoryObj } from '@storybook/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from 'polarkit'
import TopbarLayout from './TopbarLayout'

const meta: Meta<typeof TopbarLayout> = {
  title: 'Layouts/TopbarLayout',
  component: TopbarLayout,
}

export default meta

type Story = StoryObj<typeof TopbarLayout>

export const Default: Story = {
  parameters: {
    themes: ['light'],
    padding: 'p-0 m-0',
  },
  render: (args) => (
    <QueryClientProvider client={queryClient}>
      <TopbarLayout {...args}>
        <div className="bg-red-200 text-black">Content</div>
      </TopbarLayout>
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
