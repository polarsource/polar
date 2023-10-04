import type { Meta, StoryObj } from '@storybook/react'
import IssueFundingDetails from './IssueFundingDetails'

import { issue, pledger } from 'polarkit/testdata'

const meta: Meta<typeof IssueFundingDetails> = {
  title: 'Issue/IssueFundingDetails',
  component: IssueFundingDetails,
  args: {
    issueFunding: {
      issue: {
        ...issue,
        upfront_split_to_contributors: 50,
      },
      total: { amount: 45000, currency: 'USD' },
      funding_goal: { amount: 50000, currency: 'USD' },
      pledges_summaries: {
        pay_upfront: {
          total: {
            amount: 5000,
            currency: 'USD',
          },
          pledgers: [pledger, pledger],
        },
        pay_on_completion: {
          total: {
            amount: 40000,
            currency: 'USD',
          },
          pledgers: [pledger, pledger],
        },
        pay_directly: {
          total: { amount: 0, currency: 'USD' },
          pledgers: [],
        },
      },
    },
  },
}

export default meta

type Story = StoryObj<typeof IssueFundingDetails>

export const Default: Story = {}
