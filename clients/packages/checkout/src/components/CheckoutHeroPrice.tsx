'use client'

import { formatCurrency } from '@polar-sh/currency'
import type { AcceptedLocale } from '@polar-sh/i18n'
import type { ProductCheckoutPublic } from '../guards'
import { isLegacyRecurringPrice } from '../utils/product'
import AmountLabel from './AmountLabel'
import ProductPriceLabel from './ProductPriceLabel'

export interface CheckoutHeroPriceProps {
  checkout: ProductCheckoutPublic
  locale?: AcceptedLocale
}

const CheckoutHeroPrice = ({ checkout, locale }: CheckoutHeroPriceProps) => {
  const { product, productPrice, discount } = checkout

  if (discount || productPrice.amountType === 'seat_based') {
    return (
      <AmountLabel
        amount={checkout.totalAmount ?? checkout.netAmount ?? 0}
        currency={checkout.currency ?? productPrice.priceCurrency}
        interval={
          isLegacyRecurringPrice(productPrice)
            ? productPrice.recurringInterval
            : product.recurringInterval
        }
        intervalCount={product.recurringIntervalCount}
        mode="standard"
        locale={locale}
      />
    )
  }

  if (productPrice.amountType === 'custom') {
    return (
      <>
        {formatCurrency('standard', locale)(
          checkout.amount,
          checkout.currency ?? productPrice.priceCurrency,
        )}
      </>
    )
  }

  return (
    <ProductPriceLabel
      product={product}
      price={productPrice}
      locale={locale}
      mode="standard"
    />
  )
}

export default CheckoutHeroPrice
