import type { Meta, StoryObj } from '@storybook/react'

import { OverlayContents } from '../components/Pledge/Overlay'
import {
  issue,
  org,
  orgStripeCustomer,
  privateOrganization,
  repo,
  user,
} from './testdata'

const meta: Meta<typeof OverlayContents> = {
  title: 'Organisms/PledgeOverlay',
  component: OverlayContents,
  tags: ['autodocs'],
  args: {
    issueOrg: org,
    issueRepo: repo,
    issue: issue,
    organizations: [privateOrganization],
    currentUser: user,
    MINIMUM_PLEDGE: 2000,
  },
}

export default meta

type Story = StoryObj<typeof OverlayContents>

export const Default: Story = {}

export const Error: Story = {
  args: {
    ...Default.args,
    errorMessage: 'Something went wrong',
  },
}

export const NoPaymentMethod: Story = {
  args: {
    ...Default.args,
    selectedOrg: privateOrganization,
    customer: {},
  },
}

export const WithPaymentMethod: Story = {
  args: {
    ...Default.args,
    selectedOrg: privateOrganization,
    customer: orgStripeCustomer,
  },
}

export const Syncing: Story = {
  args: {
    ...Default.args,
    selectedOrg: privateOrganization,
    isSyncing: true,
  },
}

export const Done: Story = {
  args: {
    ...Default.args,
    selectedOrg: privateOrganization,
    isDone: true,
  },
}
