import type { Polar } from '@polar-sh/polar'

const findProductId = async (sdk: Polar, externalId: string) => {
  for await (const product of sdk.products.iterList({ is_recurring: false })) {
    if (product.external_id === externalId) return product.id
  }
  throw new Error(
    `Product ${JSON.stringify(externalId)} is not deployed in this environment.`,
  )
}

export const purchaseOffSession = async (
  sdk: Polar,
  externalCustomerId: string,
  productExternalId: string,
) => {
  const [customer, productId] = await Promise.all([
    sdk.customers.getExternal(externalCustomerId),
    findProductId(sdk, productExternalId),
  ])

  const draft = await sdk.orders.create({
    customer_id: customer.id,
    product_id: productId,
  })
  const order = await sdk.orders.finalize(draft.id, {})

  if (!order.paid) {
    throw new Error(`Order ${order.id} is not paid (status: ${order.status})`)
  }

  return order
}
