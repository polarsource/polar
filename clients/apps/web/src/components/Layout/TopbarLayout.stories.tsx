import { PolarQueryClientProvider } from '@/app/providers'
import type { Meta, StoryObj } from '@storybook/react'
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
    <PolarQueryClientProvider>
      <TopbarLayout {...args}>
        <div className="bg-red-200 text-black">Content</div>
      </TopbarLayout>
    </PolarQueryClientProvider>
  ),
}

export const Dark: Story = {
  ...Default,
  parameters: {
    themes: ['dark'],
    padding: 'p-0',
  },
}
