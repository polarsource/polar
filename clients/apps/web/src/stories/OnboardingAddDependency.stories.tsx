import type { Meta, StoryObj } from '@storybook/react'

import OnboardingAddDependency from '@/components/Onboarding/OnboardingAddDependency'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from 'polarkit/api'

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
      <QueryClientProvider client={queryClient}>
        <OnboardingAddDependency />
      </QueryClientProvider>
    )
  },
}
