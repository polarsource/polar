import { describe, expect, it } from 'vitest'
import {
  isPaymentSetupRequired,
  PaymentSetupSubscription,
} from './paymentSetup'

const fixed = (priceAmount: number) =>
  ({
    amount_type: 'fixed',
    price_amount: priceAmount,
  }) as PaymentSetupSubscription['prices'][number]

const metered = () =>
  ({
    amount_type: 'metered_unit',
  }) as PaymentSetupSubscription['prices'][number]

const subscription = (
  overrides: Partial<PaymentSetupSubscription>,
): PaymentSetupSubscription => ({
  amount: 2000,
  prices: [fixed(2000)],
  discount: null,
  ...overrides,
})

describe('isPaymentSetupRequired', () => {
  it('skips a saved card when every price is free', () => {
    expect(
      isPaymentSetupRequired(subscription({ amount: 0, prices: [fixed(0)] })),
    ).toBe(false)
  })

  it('skips a saved card for a zero upfront amount with no meters', () => {
    expect(
      isPaymentSetupRequired(
        subscription({
          amount: 0,
          prices: [
            {
              amount_type: 'custom',
            } as PaymentSetupSubscription['prices'][number],
          ],
        }),
      ),
    ).toBe(false)
  })

  it('requires a saved card for metered usage without a forever free discount', () => {
    expect(
      isPaymentSetupRequired(
        subscription({ amount: 0, prices: [metered()], discount: null }),
      ),
    ).toBe(true)
  })

  it('skips a saved card for a forever 100% discount, including meters', () => {
    const discount = {
      type: 'percentage',
      duration: 'forever',
      basis_points: 10_000,
    }
    expect(isPaymentSetupRequired(subscription({ amount: 0, discount }))).toBe(
      false,
    )
    expect(
      isPaymentSetupRequired(
        subscription({ amount: 0, prices: [fixed(2000), metered()], discount }),
      ),
    ).toBe(false)
  })

  it('requires a saved card for a one-time 100% discount', () => {
    expect(
      isPaymentSetupRequired(
        subscription({
          amount: 0,
          discount: {
            type: 'percentage',
            duration: 'once',
            basis_points: 10_000,
          },
        }),
      ),
    ).toBe(true)
  })

  it('requires a saved card for a forever fixed discount', () => {
    expect(
      isPaymentSetupRequired(
        subscription({
          amount: 0,
          discount: { type: 'fixed', duration: 'forever' },
        }),
      ),
    ).toBe(true)
  })
})
