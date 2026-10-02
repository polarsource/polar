import { describe, expect, it } from 'vitest'
import { moveOutcome, moveStatus } from './moveStatus'
import type { ReviewRow } from './reviewRows'

function row(overrides: Partial<ReviewRow>): ReviewRow {
  return {
    record_id: 'rec_1',
    entity: 'subscriptions',
    status: 'importable',
    import_status: 'pending',
    reason_level: null,
    dependencies_imported: false,
    payment_method_type: 'card',
    ...overrides,
  } as ReviewRow
}

describe('moveStatus', () => {
  it('drops the payment method for rows that stay on Stripe', () => {
    expect(moveStatus(row({ status: 'skipped' }))).toMatchObject({
      label: 'Stays on Stripe',
      paymentMethod: null,
    })
  })

  it('keeps the payment method for rows that will move', () => {
    expect(moveStatus(row({})).paymentMethod?.kind).toBe('card')
  })
})

describe('moveOutcome', () => {
  it.each([
    [{}, 'Moves with card', undefined],
    [{ payment_method_type: 'link' }, 'Moves, no card', 'yellow'],
    [{ payment_method_type: null }, 'Moves, no card', 'yellow'],
    [{ reason_level: 'action_required' }, 'Needs info', 'yellow'],
    [
      { reason_level: 'action_required', payment_method_type: 'link' },
      'Needs info, no card',
      'yellow',
    ],
    [{ status: 'skipped' }, 'Stays on Stripe', 'red'],
  ] as const)('labels %o as %s', (overrides, label, color) => {
    expect(moveOutcome(moveStatus(row(overrides)))).toEqual({ label, color })
  })
})
