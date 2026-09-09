export type {
  BillingOwner,
  IssueCode,
  MockSubscriptionRecord,
  PaymentReadiness,
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
  cards: {
    matching: mockSubscriptions.filter(
      (record) => record.paymentReadiness === 'matching',
    ).length,
    customerAction: mockSubscriptions.filter(
      (record) => record.paymentReadiness !== 'matching',
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
} as const

export const flowSteps = [
  'Create',
  'Assess',
  'Resolve',
  'Cards',
  'Transfer',
  'Receipt',
] as const
