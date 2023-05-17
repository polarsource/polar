import type { Meta, StoryObj } from '@storybook/react'

import OnboardingInstallChromeExtension from '../components/Onboarding/OnboardingInstallChromeExtension'

// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta: Meta<typeof OnboardingInstallChromeExtension> = {
  title: 'Onboarding/OnboardingInstallChromeExtension',
  component: OnboardingInstallChromeExtension,
  tags: ['autodocs'],
}

export default meta

type Story = StoryObj<typeof OnboardingInstallChromeExtension>

export const Default: Story = {}
