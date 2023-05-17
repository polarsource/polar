import type { Meta, StoryObj } from '@storybook/react'

import OnboardingConnectDashboard from '../components/Onboarding/OnboardingConnectDashboard'

// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta: Meta<typeof OnboardingConnectDashboard> = {
  title: 'Onboarding/OnboardingConnectDashboard',
  component: OnboardingConnectDashboard,
  tags: ['autodocs'],
}

export default meta

type Story = StoryObj<typeof OnboardingConnectDashboard>

export const Default: Story = {}
