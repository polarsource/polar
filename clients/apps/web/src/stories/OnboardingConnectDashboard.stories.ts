import type { Meta, StoryObj } from '@storybook/react'

import OnboardingConnectDashboard from '../components/Onboarding/OnboardingConnectDashboard'

const meta: Meta<typeof OnboardingConnectDashboard> = {
  title: 'Organisms/OnboardingConnectDashboard',
  component: OnboardingConnectDashboard,
  tags: ['autodocs'],
}

export default meta

type Story = StoryObj<typeof OnboardingConnectDashboard>

export const Default: Story = {}
