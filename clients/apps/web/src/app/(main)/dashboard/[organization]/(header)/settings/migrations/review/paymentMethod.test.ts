import { describe, expect, it } from 'vitest'
import { rowPaymentMethod } from './paymentMethod'
import type { ReviewRow } from './reviewRows'

function row(overrides: Partial<ReviewRow>): ReviewRow {
  return {
    entity: 'subscriptions',
    status: 'importable',
    payment_method_type: 'card',
    ...overrides,
  } as ReviewRow
}

describe('rowPaymentMethod', () => {
  it('moves a card', () => {
    expect(rowPaymentMethod(row({}))).toEqual({
      label: 'Card',
      moves: true,
      explanation: null,
    })
  })

  it.each([
    ['link', 'Link'],
    ['sepa_debit', 'SEPA Debit'],
    ['other', 'Other'],
  ] as const)('keeps %s behind', (type, label) => {
    const method = rowPaymentMethod(row({ payment_method_type: type }))
    expect(method?.label).toBe(label)
    expect(method?.moves).toBe(false)
    expect(method?.explanation).toContain("can't be copied")
  })

  it('explains a subscription with no payment method', () => {
    const method = rowPaymentMethod(row({ payment_method_type: null }))
    expect(method?.label).toBe('None')
    expect(method?.moves).toBe(false)
    expect(method?.explanation).toContain('no saved payment method')
  })

  it('says nothing for skipped rows and other entities', () => {
    expect(rowPaymentMethod(row({ status: 'skipped' }))).toBeNull()
    expect(rowPaymentMethod(row({ entity: 'customers' }))).toBeNull()
  })
})
