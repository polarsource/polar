import {
  Platforms,
  Transaction,
  TransactionDonation,
  TransactionIssue,
  TransactionIssueReward,
  TransactionOrganization,
  TransactionPledge,
  TransactionRepository,
  TransactionSubscription,
  TransactionSubscriptionPrice,
  TransactionSubscriptionTier,
} from '@polar-sh/sdk'
import type { Meta, StoryObj } from '@storybook/react'
import TransactionsList from './TransactionsList'

const meta: Meta<typeof TransactionsList> = {
  title: 'Organisms/TransactionsList',
  component: TransactionsList,
}

export default meta

type Story = StoryObj<typeof TransactionsList>

const tx: Transaction = {
  created_at: '2024-03-27',
  id: '',
  type: 'payment',
  currency: 'USD',
  amount: 12300,
  account_currency: 'USD',
  account_amount: 12300,
  account_incurred_transactions: [],
  incurred_amount: 300,
  gross_amount: 12300,
  net_amount: 12000,
}

const donation: TransactionDonation = {
  created_at: '2024-03-27',
  id: '',
  to_organization: {
    id: '',
    name: 'hello',
    is_personal: false,
    avatar_url: '',
    created_at: '2024-03-27',
    platform: Platforms.GITHUB,
  },
}

const txDonation: Transaction = {
  ...tx,
  donation,
}

const issue_reward: TransactionIssueReward = {
  created_at: '',
  id: '',
  issue_id: '',
  share_thousands: 800,
}

const organization: TransactionOrganization = {
  created_at: '',
  id: '',
  platform: 'github',
  name: 'OrgName',
  avatar_url: 'https://avatars.githubusercontent.com/u/1144727?s=60&v=4',
  is_personal: false,
}

const repository: TransactionRepository = {
  created_at: '',
  id: '',
  platform: 'github',
  organization_id: '',
  name: 'reponame',
}

const issue: TransactionIssue = {
  created_at: '',
  id: '',
  platform: 'github',
  organization_id: '',
  repository_id: '',
  number: 0,
  title: '',
  organization,
  repository,
}

const pledge: TransactionPledge = {
  created_at: '',
  id: '',
  state: 'initiated',
  issue,
}

const txIssueReward: Transaction = {
  ...tx,
  issue_reward,
  pledge,
}

const subscription_tier: TransactionSubscriptionTier = {
  created_at: '',
  id: '',
  type: 'free',
  name: 'TierName',
  organization,
}

const subscription: TransactionSubscription = {
  created_at: '',
  id: '',
  status: 'incomplete',
  subscription_tier,
}

const subscription_tier_price: TransactionSubscriptionPrice = {
  created_at: '',
  id: '',
  recurring_interval: 'month',
  price_amount: 4000,
  price_currency: 'USD',
  is_archived: false,
}

const txSubscription: Transaction = {
  ...tx,
  subscription,
  subscription_tier_price,
}

export const Default: Story = {
  args: {
    transactions: [tx, txDonation, txIssueReward, txSubscription],
    isLoading: false,
  },
}
