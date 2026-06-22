import { schemas } from '@polar-sh/client'

// Mock dispute shape for the PoC. Mirrors the real `schemas['Dispute']` fields
// the UI needs, plus a few display-only fields (customer, product) so the
// list and detail pages can render without wiring up the API.
export interface MockDispute {
  id: string
  status: schemas['DisputeStatus']
  amount: number
  tax_amount: number
  currency: string
  reason: string
  evidence_due_by: string | null
  past_due: boolean
  created_at: string
  customer_name: string
  customer_email: string
  customer_avatar_url: string | null
  product_name: string
  order_id: string
}

export const MOCK_DISPUTES: MockDispute[] = [
  {
    id: 'dsp_001',
    status: 'needs_response',
    amount: 4900,
    tax_amount: 0,
    currency: 'usd',
    reason: 'fraudulent',
    evidence_due_by: '2026-06-29T23:59:59Z',
    past_due: false,
    created_at: '2026-06-21T09:12:00Z',
    customer_name: 'Marcus Lindqvist',
    customer_email: 'marcus@northpeak.io',
    customer_avatar_url: null,
    product_name: 'Pro Plan — Monthly',
    order_id: '05404a2c-2afe-4bb4-a32c-13d7cc34e374',
  },
  {
    id: 'dsp_002',
    status: 'needs_response',
    amount: 12000,
    tax_amount: 2400,
    currency: 'usd',
    reason: 'product_not_received',
    evidence_due_by: '2026-06-20T23:59:59Z',
    past_due: true,
    created_at: '2026-06-12T16:40:00Z',
    customer_name: 'Aisha Bakker',
    customer_email: 'aisha.bakker@gmail.com',
    customer_avatar_url: null,
    product_name: 'Annual License',
    order_id: 'ord_3a90',
  },
  {
    id: 'dsp_003',
    status: 'under_review',
    amount: 2900,
    tax_amount: 0,
    currency: 'usd',
    reason: 'subscription_canceled',
    evidence_due_by: '2026-06-18T23:59:59Z',
    past_due: false,
    created_at: '2026-06-08T11:05:00Z',
    customer_name: 'Tom Devries',
    customer_email: 'tom@devries.dev',
    customer_avatar_url: null,
    product_name: 'Starter Plan — Monthly',
    order_id: 'ord_77c1',
  },
  {
    id: 'dsp_004',
    status: 'won',
    amount: 8900,
    tax_amount: 0,
    currency: 'usd',
    reason: 'product_unacceptable',
    evidence_due_by: null,
    past_due: false,
    created_at: '2026-05-28T08:20:00Z',
    customer_name: 'Sofia Romano',
    customer_email: 'sofia.romano@outlook.com',
    customer_avatar_url: null,
    product_name: 'Team Plan — Monthly',
    order_id: 'ord_1b44',
  },
  {
    id: 'dsp_005',
    status: 'lost',
    amount: 3500,
    tax_amount: 700,
    currency: 'usd',
    reason: 'duplicate',
    evidence_due_by: null,
    past_due: false,
    created_at: '2026-05-19T14:55:00Z',
    customer_name: 'James Okafor',
    customer_email: 'james@okafor.co',
    customer_avatar_url: null,
    product_name: 'One-time purchase — Templates',
    order_id: 'ord_5e02',
  },
  {
    id: 'dsp_006',
    status: 'prevented',
    amount: 1500,
    tax_amount: 0,
    currency: 'usd',
    reason: 'unrecognized',
    evidence_due_by: null,
    past_due: false,
    created_at: '2026-05-15T10:00:00Z',
    customer_name: 'Lena Fischer',
    customer_email: 'lena.fischer@web.de',
    customer_avatar_url: null,
    product_name: 'Pro Plan — Monthly',
    order_id: 'ord_9d31',
  },
]

export const getMockDispute = (id: string): MockDispute | undefined =>
  MOCK_DISPUTES.find((dispute) => dispute.id === id)
