import type { Meta, StoryObj } from '@storybook/react'

import ThankYouUpsell from '../components/Pledge/ThankYouUpsell'
import { pledgePublicAPI } from './testdata'

const meta: Meta<typeof ThankYouUpsell> = {
  title: 'Organisms/PledgeThankYouUpsell',
  component: ThankYouUpsell,
  args: {
    pledge: pledgePublicAPI,
  },
}

export default meta

type Story = StoryObj<typeof ThankYouUpsell>

export const Default: Story = {}
