import type { schemas } from '@polar-sh/client'
import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useMobileSummaryState } from './useMobileSummaryState'

type AmountType = schemas['ProductPrice']['amount_type']

function makeCheckout(
  overrides: {
    amountType?: AmountType
    isFreeProductPrice?: boolean
    activeTrialInterval?: schemas['SubscriptionRecurringInterval'] | null
    activeTrialIntervalCount?: number | null
    hasProduct?: boolean
  } = {},
): schemas['CheckoutPublic'] {
  const {
    amountType = 'fixed',
    isFreeProductPrice = false,
    activeTrialInterval = null,
    activeTrialIntervalCount = null,
    hasProduct = true,
  } = overrides

  return {
    product: hasProduct ? {} : null,
    prices: hasProduct ? {} : null,
    product_price: { amount_type: amountType },
    is_free_product_price: isFreeProductPrice,
    active_trial_interval: activeTrialInterval,
    active_trial_interval_count: activeTrialIntervalCount,
  } as unknown as schemas['CheckoutPublic']
}

describe('useMobileSummaryState', () => {
  describe('mode resolution', () => {
    it('returns "collapsed-bar" for a fixed-price product', () => {
      const { result } = renderHook(() => useMobileSummaryState(makeCheckout()))
      expect(result.current.mode).toBe('collapsed-bar')
      expect(result.current.collapses).toBe(true)
    })

    it('returns "collapsed-bar" for a trial (trial gets the bar, not full)', () => {
      const { result } = renderHook(() =>
        useMobileSummaryState(
          makeCheckout({
            activeTrialInterval: 'month',
            activeTrialIntervalCount: 1,
          }),
        ),
      )
      expect(result.current.mode).toBe('collapsed-bar')
      expect(result.current.hasTrial).toBe(true)
    })

    it('returns "full" for seat-based products', () => {
      const { result } = renderHook(() =>
        useMobileSummaryState(makeCheckout({ amountType: 'seat_based' })),
      )
      expect(result.current.mode).toBe('full')
      expect(result.current.collapses).toBe(false)
    })

    it('returns "full" for PWYW (custom amount) products', () => {
      const { result } = renderHook(() =>
        useMobileSummaryState(makeCheckout({ amountType: 'custom' })),
      )
      expect(result.current.mode).toBe('full')
    })

    it('returns "full" for free products', () => {
      const { result } = renderHook(() =>
        useMobileSummaryState(makeCheckout({ isFreeProductPrice: true })),
      )
      expect(result.current.mode).toBe('full')
    })
  })

  describe('hasTrial', () => {
    it('is true only when both active_trial_interval and count are set', () => {
      const { result: bothSet } = renderHook(() =>
        useMobileSummaryState(
          makeCheckout({
            activeTrialInterval: 'month',
            activeTrialIntervalCount: 1,
          }),
        ),
      )
      expect(bothSet.current.hasTrial).toBe(true)

      const { result: missingCount } = renderHook(() =>
        useMobileSummaryState(
          makeCheckout({
            activeTrialInterval: 'month',
            activeTrialIntervalCount: null,
          }),
        ),
      )
      expect(missingCount.current.hasTrial).toBe(false)

      const { result: neither } = renderHook(() =>
        useMobileSummaryState(makeCheckout()),
      )
      expect(neither.current.hasTrial).toBe(false)
    })
  })
})
