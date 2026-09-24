import type { MeterSpec } from './utils/org'
import { meteredSubscription } from './utils/products'
import { describe, expect, test } from './utils/test'

const USAGE: MeterSpec = {
  name: 'E2E usage',
  unit: 'scalar',
  filter: {
    conjunction: 'and',
    clauses: [{ property: 'name', operator: 'eq', value: 'e2e.usage' }],
  },
  aggregation: { func: 'count' },
}

describe('Metered subscription', () => {
  test('subscribes with nothing due today and the meter attached', async ({
    openCheckout,
    org,
  }) => {
    const meter = await org.meter(USAGE)
    const checkout = await openCheckout(meteredSubscription(meter.id))
    expect((await checkout.state()).amount).toBe(0)

    await checkout.fillEmail()
    await checkout.payWithCard()
    const portal = await checkout.submit()

    const [subscription] = await portal.subscriptions()
    expect(subscription.status).toBe('active')
    expect(subscription.amount).toBe(0)
    expect(subscription.meters.map((m) => m.meter.name)).toEqual([USAGE.name])
  })
})
