import type { ProductCheckoutPublic } from '@polar-sh/checkout/guards'
import type { schemas } from '@polar-sh/client'
import { describe, expect, it } from 'vitest'
import { isOrderSummaryCollapsible } from './checkout'

const createPrice = (
  overrides: Record<string, unknown> = {},
): schemas['ProductPrice'] =>
  ({
    id: 'price_1',
    amount_type: 'fixed',
    type: 'recurring',
    price_amount: 999,
    price_currency: 'usd',
    ...overrides,
  }) as unknown as schemas['ProductPrice']

const createCheckout = (
  overrides: Partial<ProductCheckoutPublic> = {},
): ProductCheckoutPublic => {
  const price = createPrice()
  return {
    currency: 'usd',
    product_id: 'prod_1',
    product: { id: 'prod_1', name: 'Pro', medias: [] },
    product_price: price,
    products: [{ id: 'prod_1' }],
    prices: { prod_1: [price] },
    ...overrides,
  } as unknown as ProductCheckoutPublic
}

describe('isOrderSummaryCollapsible', () => {
  it('collapses a fixed one-time price', () => {
    const checkout = createCheckout({
      product_price: createPrice({ type: 'one_time' }),
    })
    expect(isOrderSummaryCollapsible(checkout)).toBe(true)
  })

  it('collapses a subscription', () => {
    expect(isOrderSummaryCollapsible(createCheckout())).toBe(true)
  })

  it('keeps a free product open', () => {
    const freePrice = createPrice({ price_amount: 0 })
    const checkout = createCheckout({
      product_price: freePrice,
      prices: { prod_1: [freePrice] },
      is_free_product_price: true,
    })
    expect(isOrderSummaryCollapsible(checkout)).toBe(false)
  })

  it('keeps pay-what-you-want open', () => {
    const customPrice = createPrice({ amount_type: 'custom' })
    const checkout = createCheckout({
      product_price: customPrice,
      prices: { prod_1: [customPrice] },
    })
    expect(isOrderSummaryCollapsible(checkout)).toBe(false)
  })

  it('keeps seat-based pricing open', () => {
    const seatPrice = createPrice({ amount_type: 'seat_based' })
    const checkout = createCheckout({
      product_price: seatPrice,
      prices: { prod_1: [seatPrice] },
    })
    expect(isOrderSummaryCollapsible(checkout)).toBe(false)
  })

  it('keeps unit-based pricing open', () => {
    const unitPrice = createPrice({ amount_type: 'unit_based' })
    const checkout = createCheckout({
      product_price: unitPrice,
      prices: { prod_1: [unitPrice] },
    })
    expect(isOrderSummaryCollapsible(checkout)).toBe(false)
  })

  it('keeps metered pricing open', () => {
    const checkout = createCheckout({
      prices: {
        prod_1: [
          createPrice(),
          createPrice({ id: 'price_2', amount_type: 'metered_unit' }),
        ],
      },
    })
    expect(isOrderSummaryCollapsible(checkout)).toBe(false)
  })

  it('keeps a product choice open', () => {
    const checkout = createCheckout({
      products: [{ id: 'prod_1' }, { id: 'prod_2' }] as never,
    })
    expect(isOrderSummaryCollapsible(checkout)).toBe(false)
  })

  it('keeps legacy recurring prices open', () => {
    const legacyPrice = createPrice({
      legacy: true,
      recurring_interval: 'month',
    })
    const checkout = createCheckout({
      product_price: legacyPrice,
      prices: { prod_1: [legacyPrice] },
    })
    expect(isOrderSummaryCollapsible(checkout)).toBe(false)
  })
})
