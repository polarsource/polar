import { describe, expect, it } from 'vitest'
import { paymentMethodSummaryText } from './paymentMethodSummary'

describe('paymentMethodSummaryText', () => {
  it('says nothing when every card copies', () => {
    expect(
      paymentMethodSummaryText([{ assessment: 'copyable', count: 12 }]),
    ).toBeNull()
    expect(paymentMethodSummaryText([])).toBeNull()
  })

  it('breaks down the subscriptions that need a new method', () => {
    const text = paymentMethodSummaryText([
      { assessment: 'copyable', count: 30 },
      { assessment: 'india_card', count: 2 },
      { assessment: 'paypal', count: 6 },
      { assessment: 'missing', count: 1 },
    ])
    expect(text).toContain('9 subscriptions will need a new payment method')
    expect(text).toContain(
      '2 on a likely India-issued card, 6 on PayPal and 1 with no payment method',
    )
  })

  it('names a single group without a list', () => {
    expect(
      paymentMethodSummaryText([{ assessment: 'not_copyable', count: 1 }]),
    ).toContain(
      "1 subscription will need a new payment method on Polar: 1 on a method that can't be copied.",
    )
  })
})
