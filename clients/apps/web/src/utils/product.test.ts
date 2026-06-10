import { schemas } from '@polar-sh/client'
import { describe, expect, it } from 'vitest'
import { formPriceToApiPrice, productPriceToFormPrice } from './product'

type FormPrice = schemas['ProductCreate']['prices'][number]

const formPrice = (overrides: Record<string, unknown>): FormPrice =>
  ({ price_currency: 'usd', ...overrides }) as unknown as FormPrice

const apiPrice = (
  overrides: Record<string, unknown>,
): schemas['ProductPrice'] =>
  ({
    id: 'price_1',
    price_currency: 'usd',
    ...overrides,
  }) as unknown as schemas['ProductPrice']

describe('formPriceToApiPrice', () => {
  it('converts a free price to a fixed price of 0', () => {
    const result = formPriceToApiPrice(formPrice({ amount_type: 'free' }))
    expect(result).toMatchObject({
      amount_type: 'fixed',
      price_amount: 0,
      price_currency: 'usd',
    })
  })

  it('leaves a paid fixed price untouched', () => {
    const price = formPrice({ amount_type: 'fixed', price_amount: 1000 })
    expect(formPriceToApiPrice(price)).toBe(price)
  })

  it('leaves a custom price untouched', () => {
    const price = formPrice({ amount_type: 'custom', minimum_amount: 50 })
    expect(formPriceToApiPrice(price)).toBe(price)
  })
})

describe('productPriceToFormPrice', () => {
  it('surfaces a fixed price of 0 as a free price', () => {
    const result = productPriceToFormPrice(
      apiPrice({ amount_type: 'fixed', price_amount: 0 }),
    )
    expect(result.amount_type).toBe('free')
    expect('price_amount' in result).toBe(false)
  })

  it('leaves a paid fixed price untouched', () => {
    const price = apiPrice({ amount_type: 'fixed', price_amount: 1000 })
    expect(productPriceToFormPrice(price)).toBe(price)
  })

  it('leaves an existing free price untouched', () => {
    const price = apiPrice({ amount_type: 'free' })
    expect(productPriceToFormPrice(price)).toBe(price)
  })
})

describe('free price round-trips through the form as fixed-0', () => {
  it('form free -> api fixed-0 -> form free', () => {
    const api = formPriceToApiPrice(formPrice({ amount_type: 'free' }))
    expect(api.amount_type).toBe('fixed')

    const backToForm = productPriceToFormPrice(api as schemas['ProductPrice'])
    expect(backToForm.amount_type).toBe('free')
  })
})
