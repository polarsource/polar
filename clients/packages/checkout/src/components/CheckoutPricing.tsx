'use client'

import { formatCurrency } from '@polar-sh/currency'
import type { AcceptedLocale } from '@polar-sh/i18n'

import { ProductCheckoutPublic } from '../guards'
import { getDiscountDisplay } from '../utils/discount'
import { isLegacyRecurringPrice } from '../utils/product'
import AmountLabel from './AmountLabel'
import MeteredPricesDisplay from './MeteredPricesDisplay'
import ProductPriceLabel from './ProductPriceLabel'

const CheckoutProductAmountLabel = ({
  checkout,
  layout = 'default',
  locale,
}: {
  checkout: ProductCheckoutPublic
  layout?: 'default' | 'stacked'
  locale?: AcceptedLocale
}) => {
  const { product, product_price, discount } = checkout
  if (!discount || product_price.amount_type !== 'fixed') {
    return (
      <AmountLabel
        amount={checkout.total_amount}
        currency={checkout.currency ?? product_price.price_currency}
        interval={
          isLegacyRecurringPrice(product_price)
            ? product_price.recurring_interval
            : product.recurring_interval
        }
        intervalCount={product.recurring_interval_count}
        mode="compact"
        locale={locale}
      />
    )
  }

  return (
    <div
      className={
        layout === 'stacked'
          ? 'flex flex-row justify-between md:flex-col md:items-start md:gap-y-2'
          : 'flex flex-row justify-between'
      }
    >
      <AmountLabel
        amount={checkout.total_amount}
        currency={checkout.currency}
        interval={
          isLegacyRecurringPrice(product_price)
            ? product_price.recurring_interval
            : product.recurring_interval
        }
        intervalCount={product.recurring_interval_count}
        mode="compact"
        locale={locale}
      />
      <div className="flex flex-row items-center gap-x-2 text-lg">
        <div className="text-gray-400 line-through">
          <ProductPriceLabel
            product={product}
            price={product_price}
            locale={locale}
          />
        </div>

        <div className="relative rounded-xs bg-linear-to-br from-gray-400 to-gray-500 px-3 py-0.5 text-center text-sm text-white shadow-md dark:from-gray-600 dark:to-gray-700">
          <span>{getDiscountDisplay(discount, locale)}</span>

          <div className="dark:bg-polar-800 absolute top-1/2 left-0 -ml-1 flex h-2 w-2 -translate-y-1/2 transform rounded-full bg-gray-50"></div>
          <div className="dark:bg-polar-800 absolute top-1/2 right-0 -mr-1 flex h-2 w-2 -translate-y-1/2 transform rounded-full bg-gray-50"></div>
        </div>
      </div>
    </div>
  )
}

interface CheckoutPricingProps {
  checkout: ProductCheckoutPublic
  layout?: 'default' | 'stacked'
  locale?: AcceptedLocale
}

const CheckoutPricing = ({
  checkout,
  layout = 'default',
  locale,
}: CheckoutPricingProps) => {
  const { product_price } = checkout

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-light" data-testid="headline-price">
          {product_price.amount_type !== 'custom' ? (
            <CheckoutProductAmountLabel
              checkout={checkout}
              layout={layout}
              locale={locale}
            />
          ) : (
            formatCurrency('compact', locale)(
              checkout.total_amount,
              checkout.currency ?? product_price.price_currency,
            )
          )}
        </h1>

        <MeteredPricesDisplay checkout={checkout} locale={locale} />
      </div>
    </div>
  )
}

export default CheckoutPricing
