import type { schemas } from '@polar-sh/client'

interface ProductCheckoutMixin {
  product_id: string
  product: schemas['CheckoutProduct']
  product_price_id: string
  product_price: schemas['ProductPrice']
  prices: { [k: string]: schemas['ProductPrice'][] }
}

export type ProductCheckoutPublic = schemas['CheckoutPublic'] &
  ProductCheckoutMixin

export const hasProductCheckout = (
  checkout: schemas['CheckoutPublic'],
): checkout is ProductCheckoutPublic => {
  return checkout.product !== null && checkout.prices !== null
}

export const isLegacyRecurringProductPrice = (
  price: schemas['ProductPrice'] | schemas['LegacyRecurringProductPrice'],
): price is schemas['LegacyRecurringProductPrice'] => {
  return (price as schemas['LegacyRecurringProductPrice']).type === 'recurring'
}
