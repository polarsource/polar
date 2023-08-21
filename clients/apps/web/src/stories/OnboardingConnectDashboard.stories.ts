import type { Meta, StoryObj } from '@storybook/react'

import OnboardingConnectPersonalDashboard from '@/components/Onboarding/OnboardingConnectPersonalDashboard'

const meta: Meta<typeof OnboardingConnectPersonalDashboard> = {
  title: 'Organisms/OnboardingConnectPersonalDashboard',
  component: OnboardingConnectPersonalDashboard,
  tags: ['autodocs'],
}

export default meta

type Story = StoryObj<typeof OnboardingConnectPersonalDashboard>

export const Default: Story = {}
