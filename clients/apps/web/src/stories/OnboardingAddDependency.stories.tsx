import type { Meta, StoryObj } from '@storybook/react'

import { PolarQueryClientProvider } from '@/app/providers'
import OnboardingAddDependency from '@/components/Onboarding/OnboardingAddDependency'

const meta: Meta<typeof OnboardingAddDependency> = {
  title: 'Organisms/OnboardingAddDependency',
  component: OnboardingAddDependency,
  tags: ['autodocs'],
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
}

export default meta

type Story = StoryObj<typeof OnboardingAddDependency>

export const Default: Story = {
  parameters: {
    themes: ['light', 'dark'],
  },
  render: (args) => {
    return (
      <PolarQueryClientProvider>
        <OnboardingAddDependency />
      </PolarQueryClientProvider>
    )
  },
}
