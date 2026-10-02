import { describe, expect, it } from 'vitest'
import { BANK_DEBITS_STAY_BEHIND, rowPaymentMethod } from './paymentMethod'
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
  it('moves a card without a note', () => {
    expect(rowPaymentMethod(row({}))).toMatchObject({
      label: 'Card',
      kind: 'card',
      note: null,
    })
  })

  it.each([
    ['link', 'Link'],
    ['bacs_debit', 'Bacs Debit'],
    ['other', 'Other method'],
  ] as const)('flags %s as moving without a card', (type, label) => {
    const method = rowPaymentMethod(row({ payment_method_type: type }))
    expect(method).toMatchObject({ label, kind: 'no_card' })
    expect(method?.note?.body).toContain("can't be copied")
  })

  it('flags a subscription with no payment method', () => {
    const method = rowPaymentMethod(row({ payment_method_type: null }))
    expect(method).toMatchObject({ label: 'No method', kind: 'no_card' })
    expect(method?.note?.body).toContain('no saved payment method')
  })

  it.each(['sepa_debit', 'us_bank_account'] as const)(
    'follows the bank-debit switch for %s',
    (type) => {
      expect(rowPaymentMethod(row({ payment_method_type: type }))?.kind).toBe(
        BANK_DEBITS_STAY_BEHIND ? 'no_card' : 'bank_debit',
      )
    },
  )

  it('says nothing when the API omits the field', () => {
    expect(rowPaymentMethod(row({ payment_method_type: undefined }))).toBeNull()
  })

  it('says nothing for skipped rows and other entities', () => {
    expect(rowPaymentMethod(row({ status: 'skipped' }))).toBeNull()
    expect(rowPaymentMethod(row({ import_status: 'skipped' }))).toBeNull()
    expect(rowPaymentMethod(row({ entity: 'customers' }))).toBeNull()
  })
})
