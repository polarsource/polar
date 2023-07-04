import type { Meta, StoryObj } from '@storybook/react'

import OnboardingAddBadge from '@/components/Onboarding/OnboardingAddBadge'

const meta: Meta<typeof OnboardingAddBadge> = {
  title: 'Organisms/OnboardingAddBadge',
  component: OnboardingAddBadge,
  tags: ['autodocs'],
}

export default meta

type Story = StoryObj<typeof OnboardingAddBadge>

export const Default: Story = {}
