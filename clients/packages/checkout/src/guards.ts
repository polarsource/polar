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

export const getSeatPrice = (
  checkout: schemas['CheckoutPublic'],
): schemas['ProductPriceSeatBased'] | null => {
  if (!checkout.product || !checkout.prices) {
    return null
  }

  const prices = checkout.prices[checkout.product.id]

  if (!prices) {
    return null
  }

  return (
    prices
      .filter((price) => price.price_currency === checkout.currency)
      .find(
        (price): price is schemas['ProductPriceSeatBased'] =>
          price.amount_type === 'seat_based',
      ) ?? null
  )
}
