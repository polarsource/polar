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
  const { product, product_price } = checkout
  const hasTrial =
    checkout.active_trial_interval && checkout.active_trial_interval_count

  if (hasTrial) {
    return <CheckoutTrialHeroPrice checkout={checkout} locale={locale} />
  }

  return (
    <AmountLabel
      amount={checkout.total_amount ?? checkout.net_amount ?? 0}
      currency={checkout.currency ?? product_price.price_currency}
      interval={
        isLegacyRecurringPrice(product_price)
          ? product_price.recurring_interval
          : product.recurring_interval
      }
      intervalCount={product.recurring_interval_count}
      mode="standard"
      locale={locale}
    />
  )
}

export default CheckoutHeroPrice
