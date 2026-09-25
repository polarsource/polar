import { PRODUCTS, withRequiredCustomField } from './utils/products'
import { describe, expect, test } from './utils/test'

const COMPANY = {
  type: 'text',
  slug: 'e2e-company',
  name: 'E2E Company',
  properties: {},
} as const

describe('Custom field', () => {
  test('stores the answer on the order', async ({ openCheckout, org }) => {
    const field = await org.customField(COMPANY)
    const checkout = await openCheckout(
      withRequiredCustomField(PRODUCTS.oneTimePurchase, field.id),
    )

    await checkout.fillEmail()
    await checkout.fillCustomField(COMPANY.name, 'Polar Software')
    await checkout.payWithCard()
    const portal = await checkout.submit()

    const [order] = await portal.orders()
    expect((await org.order(order.id)).custom_field_data?.[COMPANY.slug]).toBe(
      'Polar Software',
    )
  })
})
