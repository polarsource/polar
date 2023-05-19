import type { Meta, StoryObj } from '@storybook/react'

import OnboardingConnectReposToGetStarted from '../components/Onboarding/OnboardingConnectReposToGetStarted'

const meta: Meta<typeof OnboardingConnectReposToGetStarted> = {
  title: 'Organisms/OnboardingConnectReposToGetStarted',
  component: OnboardingConnectReposToGetStarted,
  tags: ['autodocs'],
}

export default meta

type Story = StoryObj<typeof OnboardingConnectReposToGetStarted>

export const Default: Story = {}
