import { PolarQueryClientProvider } from '@/app/providers'
import type { Meta, StoryObj } from '@storybook/react'
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
    <PolarQueryClientProvider>
      <PublicLayout {...args}>
        <div className="bg-red-200 text-black">Content</div>
      </PublicLayout>
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
