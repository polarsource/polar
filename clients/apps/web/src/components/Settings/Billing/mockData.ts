export type BillingInterval = 'month' | 'year'

export type BillingPlanId =
  | 'starter'
  | 'pro'
  | 'startup'
  | 'scale'
  | 'enterprise'

export type BillingPlan = {
  id: BillingPlanId
  name: string
  description: string
  amount: number
  currency: string
  interval: BillingInterval
  fees: string[]
  features: string[]
  contactSales?: boolean
  highlight?: boolean
}

export type ScheduledPlanChange = {
  planId: BillingPlanId
  effectiveAt: string
}

export type BillingSubscription = {
  planId: BillingPlanId
  status: 'active' | 'past_due' | 'canceled' | 'trialing'
  startedAt: string
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  scheduledPlanChange: ScheduledPlanChange | null
  paymentMethod: {
    brand: string
    last4: string
  }
}

export type BillingOrder = {
  id: string
  number: string
  date: string
  description: string
  amount: number
  currency: string
  status: 'paid' | 'pending' | 'refunded' | 'void'
  invoiceUrl: string
}

export const BILLING_PLANS: BillingPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Free to start & validate ideas',
    amount: 0,
    currency: 'USD',
    interval: 'month',
    fees: ['5.0% + 50¢'],
    features: ['All billing features', 'Standard Support'],
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For entrepreneurs & early teams',
    amount: 2000,
    currency: 'USD',
    interval: 'month',
    fees: ['3.80% + 0.35¢'],
    features: ['Prioritized Ticket support', 'Team permissions'],
    highlight: true,
  },
  {
    id: 'startup',
    name: 'Startup',
    description: 'For scaling startups',
    amount: 10000,
    currency: 'USD',
    interval: 'month',
    fees: ['3.60% + 0.30¢'],
    features: ['Prioritized Ticket support', 'Team permissions'],
  },
  {
    id: 'scale',
    name: 'Scale',
    description: 'For fast growing businesses',
    amount: 40000,
    currency: 'USD',
    interval: 'month',
    fees: ['3.40% + 0.30¢'],
    features: [
      'Prioritized Ticket support',
      'Team permissions',
      'Slack Channel',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For organizations with custom needs',
    amount: 0,
    currency: 'USD',
    interval: 'month',
    contactSales: true,
    fees: ['Custom rates'],
    features: [
      'Dedicated account manager',
      'SSO & advanced compliance',
      'SLA guarantees',
      'Custom contracts',
    ],
  },
]

export const MOCK_SUBSCRIPTION: BillingSubscription = {
  planId: 'pro',
  status: 'active',
  startedAt: '2025-08-12T09:30:00Z',
  currentPeriodStart: '2026-04-12T09:30:00Z',
  currentPeriodEnd: '2026-05-12T09:30:00Z',
  cancelAtPeriodEnd: false,
  scheduledPlanChange: null,
  paymentMethod: {
    brand: 'Visa',
    last4: '4242',
  },
}

export const MOCK_ORDERS: BillingOrder[] = [
  {
    id: 'ord_9k2j',
    number: 'POL-2026-0009',
    date: '2026-04-12T09:30:00Z',
    description: 'Pro subscription',
    amount: 2000,
    currency: 'USD',
    status: 'paid',
    invoiceUrl: '#',
  },
  {
    id: 'ord_8h1f',
    number: 'POL-2026-0008',
    date: '2026-03-12T09:30:00Z',
    description: 'Pro subscription',
    amount: 2000,
    currency: 'USD',
    status: 'paid',
    invoiceUrl: '#',
  },
  {
    id: 'ord_7g0e',
    number: 'POL-2026-0007',
    date: '2026-02-12T09:30:00Z',
    description: 'Pro subscription',
    amount: 2000,
    currency: 'USD',
    status: 'paid',
    invoiceUrl: '#',
  },
  {
    id: 'ord_6f9d',
    number: 'POL-2026-0006',
    date: '2026-01-12T09:30:00Z',
    description: 'Pro subscription',
    amount: 2000,
    currency: 'USD',
    status: 'paid',
    invoiceUrl: '#',
  },
  {
    id: 'ord_5e8c',
    number: 'POL-2025-0012',
    date: '2025-12-12T09:30:00Z',
    description: 'Pro subscription',
    amount: 2000,
    currency: 'USD',
    status: 'paid',
    invoiceUrl: '#',
  },
  {
    id: 'ord_4d7b',
    number: 'POL-2025-0011',
    date: '2025-11-12T09:30:00Z',
    description: 'Pro subscription',
    amount: 2000,
    currency: 'USD',
    status: 'refunded',
    invoiceUrl: '#',
  },
]

export const getPlanById = (id: BillingPlanId): BillingPlan =>
  BILLING_PLANS.find((p) => p.id === id) ?? BILLING_PLANS[0]
