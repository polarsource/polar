import type { Meta, StoryObj } from '@storybook/react'

import OnboardingConnectReposToGetStarted from '../components/Onboarding/OnboardingConnectReposToGetStarted'

// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta: Meta<typeof OnboardingConnectReposToGetStarted> = {
  title: 'Onboarding/OnboardingConnectReposToGetStarted',
  component: OnboardingConnectReposToGetStarted,
  tags: ['autodocs'],
}

export default meta

type Story = StoryObj<typeof OnboardingConnectReposToGetStarted>

export const Default: Story = {}
