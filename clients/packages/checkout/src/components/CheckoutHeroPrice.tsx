'use client'

import type { AcceptedLocale } from '@polar-sh/i18n'
import type { ProductCheckoutPublic } from '../guards'
import { isLegacyRecurringPrice } from '../utils/product'
import AmountLabel from './AmountLabel'
import CheckoutTrialHeroPrice from './CheckoutTrialHeroPrice'

export interface CheckoutHeroPriceProps {
  checkout: ProductCheckoutPublic
  locale?: AcceptedLocale
}

const CheckoutHeroPrice = ({ checkout, locale }: CheckoutHeroPriceProps) => {
  const { product, productPrice } = checkout

  const hasTrial =
    checkout.activeTrialInterval && checkout.activeTrialIntervalCount

  if (hasTrial) {
    return <CheckoutTrialHeroPrice checkout={checkout} locale={locale} />
  }

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

export default CheckoutHeroPrice
