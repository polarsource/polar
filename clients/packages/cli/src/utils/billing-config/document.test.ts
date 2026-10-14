import { describe, expect, test } from 'vitest'
import { Effect } from 'effect'
import { renderDocument } from '@/utils/billing-config/document'

describe('renderDocument', () => {
  test('writes a one-time product as .once()', async () => {
    const source = await Effect.runPromise(
      renderDocument('polar.config.ts', {
        meters: [],
        products: [
          {
            external_id: 'lifetime',
            name: 'Lifetime',
            recurring_interval: null,
            recurring_interval_count: null,
            prices: [
              {
                amount_type: 'fixed',
                price_currency: 'usd',
                price_amount: 9900,
              },
            ],
            benefits: [],
          },
        ],
      }),
    )

    expect(source).toContain('.once()')
  })
})
