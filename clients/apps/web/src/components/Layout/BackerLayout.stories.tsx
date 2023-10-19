import { PolarQueryClientProvider } from '@/app/providers'
import type { Meta, StoryObj } from '@storybook/react'
import BackerLayout from './BackerLayout'

const meta: Meta<typeof BackerLayout> = {
  title: 'Layouts/BackerLayout',
  component: BackerLayout,
}

export default meta

type Story = StoryObj<typeof BackerLayout>

export const Default: Story = {
  parameters: {
    themes: ['light'],
    padding: 'p-0 m-0',
  },
  render: (args) => (
    <PolarQueryClientProvider>
      <BackerLayout {...args}>
        <div className="bg-red-200 text-black">Content</div>
      </BackerLayout>
    </PolarQueryClientProvider>
  ),
}

export const NoOnboardingBanner: Story = {
  parameters: {
    themes: ['light'],
    padding: 'p-0 m-0',
  },
  args: {
    disableOnboardingBanner: true,
  },
  ...Default,
}

export const Dark: Story = {
  ...Default,
  parameters: {
    themes: ['dark'],
    padding: 'p-0',
  },
}

export const DarkNoOnboardingBanner: Story = {
  ...Default,
  parameters: {
    themes: ['dark'],
    padding: 'p-0',
  },
  args: {
    disableOnboardingBanner: true,
  },
}
