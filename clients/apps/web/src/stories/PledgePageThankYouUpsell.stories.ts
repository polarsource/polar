import type { Meta, StoryObj } from '@storybook/react'

import ThankYouUpsell from '../components/Pledge/ThankYouUpsell'

const meta: Meta<typeof ThankYouUpsell> = {
  title: 'Organisms/PledgeThankYouUpsell',
  component: ThankYouUpsell,
  args: {},
}

export default meta

type Story = StoryObj<typeof ThankYouUpsell>

export const Default: Story = {}
