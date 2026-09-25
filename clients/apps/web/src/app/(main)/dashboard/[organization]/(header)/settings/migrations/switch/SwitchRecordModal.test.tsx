import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SwitchRecordModal } from './SwitchRecordModal'
import type { SwitchRow } from './switchRows'

vi.mock('@/hooks/queries/merchantMigrations', () => ({
  useUpdateMigrationRecord: () => ({
    mutateAsync: vi.fn(),
    isError: false,
    error: null,
  }),
}))

const row = {
  record_id: 'rec_1',
  entity: 'subscriptions',
  source_id: 'sub_1SskjEEpeIZocHe9X3o9J1yM',
  title: 'ada@example.com',
  subtitle: 'active',
  product_name: 'Pro',
  product_source_id: 'prod_123',
  customer_email: 'ada@example.com',
  customer_name: 'Ada Lovelace',
  customer_source_id: 'cus_123',
  customer_country: 'US',
  amount: 2900,
  currency: 'usd',
  recurring_interval: 'month',
  recurring_interval_count: 1,
  automatic_tax: true,
  tax_behavior: 'inclusive',
  discount_name: null,
  discount_code: null,
  status: 'importable',
  import_status: 'imported',
  reason: null,
  reason_code: null,
  reason_level: null,
  conflicting_customer_id: null,
  cutover_status: 'skipped',
  cutover_error: 'Card was declined',
  renews_at: '2027-06-09T00:00:00Z',
  has_payment_method: false,
  dependencies_imported: true,
} as SwitchRow

describe('SwitchRecordModal', () => {
  it('groups the decision, then customer, product, and subscription', () => {
    render(
      <SwitchRecordModal row={row} migrationId="mig_1" onClose={() => {}} />,
    )

    expect(
      screen.getAllByRole('heading').map((heading) => heading.textContent),
    ).toEqual([
      'ada@example.com',
      'Before switch',
      'Customer',
      'Product',
      'Subscription',
    ])

    expect(screen.getByText('No payment method')).toBeTruthy()
    expect(screen.getByText('ada@example.com', { selector: 'h2' })).toBeTruthy()
    expect(screen.getByText('Email')).toBeTruthy()
    expect(screen.getByText('Stripe customer ID')).toBeTruthy()
    expect(screen.getByText('cus_123')).toBeTruthy()
    expect(screen.getByText('Stripe product ID')).toBeTruthy()
    expect(screen.getByText('Renewal on Stripe')).toBeTruthy()
    expect(screen.getByText('Tax after switch')).toBeTruthy()
    expect(screen.queryByText('This one failed')).toBeNull()
    expect(screen.getAllByText('Left on Stripe').length).toBeGreaterThan(0)
    expect(screen.getByText('active')).toBeTruthy()
    expect(screen.getByText('Stripe subscription ID')).toBeTruthy()
  })
})
