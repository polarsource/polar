import type { CheckoutProduct } from '@polar-sh/sdk/models/components/checkoutproduct'
import type { CheckoutPublic } from '@polar-sh/sdk/models/components/checkoutpublic'
import type { ProductPrice } from '@polar-sh/sdk/models/components/productprice'

interface ProductCheckoutMixin {
  product_id: string
  product: CheckoutProduct
  productPriceId: string
  productPrice: ProductPrice
  prices: { [k: string]: ProductPrice[] }
}

export type ProductCheckoutPublic = CheckoutPublic & ProductCheckoutMixin

export const hasProductCheckout = (
  checkout: CheckoutPublic,
): checkout is ProductCheckoutPublic => {
  return checkout.product !== null && checkout.prices !== null
}
