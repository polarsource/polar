import { components } from '@polar-sh/client'
import type { Meta, StoryObj } from '@storybook/react'
import TransactionsList from './TransactionsList'

const meta: Meta<typeof TransactionsList> = {
  title: 'Organisms/TransactionsList',
  component: TransactionsList,
}

export default meta

type Story = StoryObj<typeof TransactionsList>

const tx: components['schemas']['Transaction'] = {
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

const issue_reward: components['schemas']['TransactionIssueReward'] = {
  created_at: '',
  modified_at: null,
  id: '',
  issue_id: '',
  share_thousands: 800,
}

const organization: components['schemas']['TransactionOrganization'] = {
  created_at: '',
  modified_at: null,
  id: '',
  name: 'OrgName',
  slug: 'OrgName',
  avatar_url: 'https://avatars.githubusercontent.com/u/1144727?s=60&v=4',
}

const externalOrganization: components['schemas']['TransactionExternalOrganization'] =
  {
    id: '',
    created_at: '',
    modified_at: null,
    name: 'OrgName',
    platform: 'github',
    avatar_url: 'https://avatars.githubusercontent.com/u/1144727?s=60&v=4',
    is_personal: false,
  }

const repository: components['schemas']['TransactionRepository'] = {
  created_at: '',
  modified_at: null,
  id: '',
  platform: 'github',
  organization_id: '',
  name: 'reponame',
}

const issue: components['schemas']['TransactionIssue'] = {
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

const pledge: components['schemas']['TransactionPledge'] = {
  created_at: '',
  modified_at: null,
  id: '',
  state: 'initiated',
  issue,
}

const txIssueReward: components['schemas']['Transaction'] = {
  ...tx,
  issue_reward,
  pledge,
}

const product: components['schemas']['TransactionProduct'] = {
  created_at: '',
  modified_at: null,
  id: '',
  name: 'TierName',
  organization_id: organization.id,
  organization,
}

const product_price: components['schemas']['ProductPrice'] = {
  created_at: '',
  modified_at: null,
  id: '',
  amount_type: 'fixed',
  type: 'recurring',
  recurring_interval: 'month',
  price_amount: 4000,
  price_currency: 'usd',
  is_archived: false,
  product_id: product.id,
}

const order: components['schemas']['TransactionOrder'] = {
  created_at: '',
  modified_at: null,
  id: '',
  product,
  product_price,
  subscription_id: null,
}

const txOrder: components['schemas']['Transaction'] = {
  ...tx,
  order,
}

export const Default: Story = {
  args: {
    transactions: [tx, txIssueReward, txOrder],
    isLoading: false,
  },
}
