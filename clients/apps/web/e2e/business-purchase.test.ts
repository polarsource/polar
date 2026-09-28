import { PRODUCTS } from './utils/products'
import { describe, expect, test } from './utils/test'

describe('Business purchase', () => {
  test('keeps the business name and tax ID on the checkout', async ({
    openCheckout,
  }) => {
    const checkout = await openCheckout(PRODUCTS.oneTimePurchase)
    await checkout.fillEmail()
    await checkout.payWithCard()
    await checkout.purchaseAsBusiness({
      name: 'E2E Business Inc',
      taxId: '12-3456789',
    })

    const portal = await checkout.submit()

    const state = await checkout.state()
    expect(state.is_business_customer).toBe(true)
    expect(state.customer_billing_name).toBe('E2E Business Inc')
    expect(state.customer_tax_id).toBe('123456789')
    const [order] = await portal.orders()
    expect(order.paid).toBe(true)
    expect(order.billing_name).toBe('E2E Business Inc')
  })
})
