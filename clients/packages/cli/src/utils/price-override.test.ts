import { describe, expect, test } from 'vitest'
import { Effect } from 'effect'
import type { LoadedConfig } from '@/schemas/BillingConfig'
import { setPrices } from '@/utils/price-override'

const config: LoadedConfig = {
  file: 'polar.json',
  source: '{}',
  input: {
    products: [
      {
        external_id: 'starter',
        prices: [
          { amount_type: 'fixed', price_currency: 'usd', price_amount: 900 },
          { amount_type: 'fixed', price_currency: 'jpy', price_amount: 1500 },
        ],
      },
    ],
  },
  generated: false,
}

const prices = (result: LoadedConfig) =>
  (result.input as { products: [{ prices: unknown[] }] }).products[0].prices

describe('setPrices', () => {
  test('sets fixed prices in minor units of their currency', async () => {
    const result = await Effect.runPromise(
      setPrices(config, ['starter.usd=12.5', 'starter.JPY=2000']),
    )
    expect(prices(result)).toEqual([
      { amount_type: 'fixed', price_currency: 'usd', price_amount: 1250 },
      { amount_type: 'fixed', price_currency: 'jpy', price_amount: 2000 },
    ])
    expect(prices(config)[0]).toMatchObject({ price_amount: 900 })
  })

  test.each([
    ['starter=12', 'Invalid --set "starter=12"'],
    ['starter.usd=-1', 'Invalid --set "starter.usd=-1"'],
    ['pro.usd=12', 'polar.json has no product "pro"'],
    ['starter.eur=12', 'starter has no fixed EUR price in polar.json'],
  ])('rejects %s', async (set, message) => {
    const error = await Effect.runPromise(Effect.flip(setPrices(config, [set])))
    expect(error.message).toBe(message)
  })
})
