import type { Meta, StoryObj } from '@storybook/react'
import IssueFundingDetails from './IssueFundingDetails'

import { issue, pledger } from '@/utils/testdata'

const meta: Meta<typeof IssueFundingDetails> = {
  title: 'Issue/IssueFundingDetails',
  component: IssueFundingDetails,
  args: {
    issue: {
      ...issue,
      upfront_split_to_contributors: 50,
    },
    total: { amount: 45000, currency: 'usd' },
    pledgesSummaries: {
      pay_upfront: {
        total: {
          amount: 5000,
          currency: 'usd',
        },
        pledgers: [pledger, pledger],
      },
      pay_on_completion: {
        total: {
          amount: 40000,
          currency: 'usd',
        },
        pledgers: [pledger, pledger],
      },
      pay_directly: {
        total: { amount: 0, currency: 'usd' },
        pledgers: [],
      },
    },
  },
}

export default meta

type Story = StoryObj<typeof IssueFundingDetails>

export const Default: Story = {}
