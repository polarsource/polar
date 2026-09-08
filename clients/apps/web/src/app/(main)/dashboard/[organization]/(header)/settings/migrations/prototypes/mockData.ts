export type {
  BillingOwner,
  IssueCode,
  MockSubscriptionRecord,
  SubscriptionCategory,
  SubscriptionStatus,
} from './mockTypes'

import { cleanSubscriptions } from './mockClean'
import { problemSubscriptions } from './mockProblems'
import type { MockSubscriptionRecord } from './mockTypes'

export const mockSubscriptions: MockSubscriptionRecord[] = [
  ...cleanSubscriptions,
  ...problemSubscriptions,
]

const CLEAN_COUNT = cleanSubscriptions.length
const PROBLEM_COUNT = problemSubscriptions.length

export const mockMigration = {
  sourceAccount: 'acct_pepy_2026',
  subscriptions: {
    total: mockSubscriptions.length,
    eligible: CLEAN_COUNT,
    decisions: problemSubscriptions.filter(
      (record) => record.status === 'action_required',
    ).length,
    stripe: mockSubscriptions.length,
    polar: 0,
    unknown: 0,
  },
  cards: {
    matching:
      CLEAN_COUNT +
      problemSubscriptions.filter(
        (record) =>
          record.issueCode === 'expired_card' ||
          record.issueCode === 'renewal_inside_safety_window',
      ).length,
    customerAction: problemSubscriptions.filter(
      (record) =>
        record.issueCode === 'missing_payment_method' ||
        record.issueCode === 'expired_card' ||
        record.issueCode === 'payment_method_requires_reentry',
    ).length,
  },
  transfer: {
    selected: CLEAN_COUNT,
    moved: CLEAN_COUNT,
    stripe: PROBLEM_COUNT,
    recovery: 0,
    unknown: 0,
    monthlyValue: '$450',
    renewalWindow: 'Sep 11–18',
  },
  decisions: [
    {
      title: 'Map Stripe Pro to Polar Pro',
      detail: 'Existing Polar product mapping needs confirmation',
      kind: 'Product',
    },
    {
      title: 'Confirm customer identities',
      detail: 'Email matches require reconciliation',
      kind: 'Identity',
    },
    {
      title: 'Confirm billing countries',
      detail: 'Issuer country is only a suggestion',
      kind: 'Tax',
    },
  ],
} as const

export const flowSteps = [
  'Create',
  'Assess',
  'Resolve',
  'Cards',
  'Transfer',
  'Receipt',
] as const
