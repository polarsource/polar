import { describe, expect, it } from 'vitest'
import { cardStatusSummaryText, paymentMethodDetail } from './cardStatus'

describe('cardStatusSummaryText', () => {
  it('says nothing when every card is ready', () => {
    expect(cardStatusSummaryText([{ status: 'ready', count: 8 }])).toBeNull()
    expect(cardStatusSummaryText([])).toBeNull()
  })

  it('breaks down the subscriptions the copy left without a usable card', () => {
    const text = cardStatusSummaryText([
      { status: 'ready', count: 30 },
      { status: 'india_card', count: 2 },
      { status: 'no_card', count: 3 },
    ])
    expect(text).toContain('5 subscriptions not switched yet')
    expect(text).toContain(
      '2 with an India-issued card and 3 with no card on Polar',
    )
  })
})

describe('paymentMethodDetail', () => {
  it('explains what the copy left before falling back to coverage', () => {
    expect(
      paymentMethodDetail({
        card_status: 'india_card',
        has_payment_method: false,
      }),
    ).toContain('India-issued card')
    expect(
      paymentMethodDetail({ card_status: 'ready', has_payment_method: true }),
    ).toBe('Ready to charge')
    expect(
      paymentMethodDetail({ card_status: null, has_payment_method: false }),
    ).toBe('No payment method')
    expect(
      paymentMethodDetail({ card_status: null, has_payment_method: null }),
    ).toBeNull()
  })
})
