import type { Meta, StoryObj } from '@storybook/react'

import OnboardingInstallChromeExtension from '../components/Onboarding/OnboardingInstallChromeExtension'

const meta: Meta<typeof OnboardingInstallChromeExtension> = {
  title: 'Organisms/OnboardingInstallChromeExtension',
  component: OnboardingInstallChromeExtension,
  tags: ['autodocs'],
}

export default meta

type Story = StoryObj<typeof OnboardingInstallChromeExtension>

export const Default: Story = {}
