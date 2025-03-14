import { schemas } from '@polar-sh/client'
import type { Meta, StoryObj } from '@storybook/react'
import TransactionsList from './TransactionsList'

const meta: Meta<typeof TransactionsList> = {
  title: 'Organisms/TransactionsList',
  component: TransactionsList,
}

export default meta

type Story = StoryObj<typeof TransactionsList>

const tx: schemas['Transaction'] = {
  created_at: '2024-03-27',
  modified_at: null,
  id: '',
  type: 'payment',
  processor: 'stripe',
  currency: 'usd',
  amount: 12300,
  account_currency: 'usd',
  account_amount: 12300,
  account_incurred_transactions: [],
  incurred_amount: 300,
  gross_amount: 12300,
  net_amount: 12000,
  platform_fee_type: null,
  pledge_id: null,
  issue_reward_id: null,
  order_id: null,
  payout_transaction_id: null,
  incurred_by_transaction_id: null,
  pledge: null,
  issue_reward: null,
  order: null,
}

const issue_reward: schemas['TransactionIssueReward'] = {
  created_at: '',
  modified_at: null,
  id: '',
  issue_id: '',
  share_thousands: 800,
}

const organization: schemas['TransactionOrganization'] = {
  created_at: '',
  modified_at: null,
  id: '',
  name: 'OrgName',
  slug: 'OrgName',
  avatar_url: 'https://avatars.githubusercontent.com/u/1144727?s=60&v=4',
}

const externalOrganization: schemas['TransactionExternalOrganization'] = {
  id: '',
  created_at: '',
  modified_at: null,
  name: 'OrgName',
  platform: 'github',
  avatar_url: 'https://avatars.githubusercontent.com/u/1144727?s=60&v=4',
  is_personal: false,
}

const repository: schemas['TransactionRepository'] = {
  created_at: '',
  modified_at: null,
  id: '',
  platform: 'github',
  organization_id: '',
  name: 'reponame',
}

const issue: schemas['TransactionIssue'] = {
  created_at: '',
  modified_at: null,
  id: '',
  platform: 'github',
  organization_id: '',
  repository_id: '',
  number: 0,
  title: '',
  organization: externalOrganization,
  repository,
}

const pledge: schemas['TransactionPledge'] = {
  created_at: '',
  modified_at: null,
  id: '',
  state: 'initiated',
  issue,
}

const txIssueReward: schemas['Transaction'] = {
  ...tx,
  issue_reward,
  pledge,
}

const product: schemas['TransactionProduct'] = {
  created_at: '',
  modified_at: null,
  id: '',
  name: 'TierName',
  organization_id: organization.id,
  recurring_interval: 'month',
  organization,
}

const order: schemas['TransactionOrder'] = {
  created_at: '',
  modified_at: null,
  id: '',
  product,
  subscription_id: null,
}

const txOrder: schemas['Transaction'] = {
  ...tx,
  order,
}

export const Default: Story = {
  args: {
    transactions: [tx, txIssueReward, txOrder],
    isLoading: false,
  },
}
