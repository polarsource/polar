import { describe, expect, it } from 'vitest'
import type { SwitchRow } from './switchRows'
import { switchStatus } from './switchStatus'

const baseRow = {
  record_id: 'rec_1',
  entity: 'subscriptions' as const,
  source_id: 'sub_1',
  title: 'ada@example.com',
  subtitle: null,
  amount: 2900,
  currency: 'usd',
  recurring_interval: 'month',
  reason: null,
  reason_code: null,
  reason_level: null,
  import_status: 'imported' as const,
  cutover_status: null,
  cutover_error: null,
  renews_at: null,
  has_payment_method: true,
}

function row(overrides: Partial<SwitchRow>): SwitchRow {
  return { ...baseRow, ...overrides } as SwitchRow
}

describe('switchStatus', () => {
  it('shows "Switched" (green) when moved', () => {
    expect(switchStatus(row({ cutover_status: 'moved' }))).toEqual({
      label: 'Switched',
      color: 'green',
    })
  })

  it('shows "Failed" (red) when failed', () => {
    expect(switchStatus(row({ cutover_status: 'failed' }))).toEqual({
      label: 'Failed',
      color: 'red',
    })
  })

  it('shows "Left on Stripe" (yellow) when skipped', () => {
    expect(switchStatus(row({ cutover_status: 'skipped' }))).toEqual({
      label: 'Left on Stripe',
      color: 'yellow',
    })
  })

  it('hints "No payment method" (yellow) for a pending row without a card', () => {
    expect(switchStatus(row({ has_payment_method: false }))).toEqual({
      label: 'No payment method',
      color: 'yellow',
    })
  })

  it('shows "Ready" for a pending row with a card', () => {
    expect(switchStatus(row({ has_payment_method: true }))).toEqual({
      label: 'Ready',
    })
  })

  // The engine re-reads Stripe, so a settled outcome always wins over the
  // pre-switch card hint.
  it('prefers the settled outcome over the card hint', () => {
    expect(
      switchStatus(row({ cutover_status: 'moved', has_payment_method: false })),
    ).toEqual({ label: 'Switched', color: 'green' })
  })
})
