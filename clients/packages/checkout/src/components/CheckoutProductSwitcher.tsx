'use client'

import type { schemas } from '@polar-sh/client'
import {
  DEFAULT_LOCALE,
  useTranslations,
  type AcceptedLocale,
} from '@polar-sh/i18n'
import {
  RadioGroup,
  RadioGroupItem,
} from '@polar-sh/ui/components/ui/radio-group'
import { ThemingPresetProps } from '@polar-sh/ui/hooks/theming'
import { cn } from '@polar-sh/ui/lib/utils'
import { useCallback, useMemo } from 'react'
import type { ProductCheckoutPublic } from '../guards'
import { isLegacyRecurringProductPrice } from '../guards'
import { hasLegacyRecurringPrices } from '../utils/product'
import { capitalize, decapitalize } from '../utils/string'
import AmountLabel from './AmountLabel'
import ProductPriceLabel from './ProductPriceLabel'

export interface CheckoutProductSwitcherItemPriceProps {
  isSelected: boolean
  product: ProductCheckoutPublic['product']
  price: schemas['ProductPrice'] | schemas['LegacyRecurringProductPrice']
  checkout: ProductCheckoutPublic
  locale?: AcceptedLocale
}

export const CheckoutProductSwitcherItemPrice = ({
  isSelected,
  product,
  price,
  checkout,
  locale,
}: CheckoutProductSwitcherItemPriceProps) => {
  if (price.amount_type === 'seat_based') {
    if (isSelected) {
      return (
        <AmountLabel
          amount={checkout.net_amount || 0}
          currency={price.price_currency}
          interval={product.recurring_interval}
          intervalCount={product.recurring_interval_count}
          mode="standard"
          locale={locale}
        />
      )
    }

    const minimumAmount =
      (price.seat_tiers?.tiers?.[0]?.price_per_seat ?? 0) *
      (price.seat_tiers?.minimum_seats ?? 1)

    return (
      <FromPrice
        amount={minimumAmount}
        currency={price.price_currency}
        interval={product.recurring_interval}
        intervalCount={product.recurring_interval_count}
        locale={locale}
      />
    )
  }

  return (
    <ProductPriceLabel
      product={product}
      price={price}
      locale={locale}
      mode="standard"
    />
  )
}

const FromPrice = ({
  amount,
  currency,
  interval,
  intervalCount,
  locale,
}: {
  amount: number
  currency: string
  interval?: schemas['SubscriptionRecurringInterval'] | null
  intervalCount?: number | null
  locale?: AcceptedLocale
}) => {
  const t = useTranslations(locale ?? DEFAULT_LOCALE)
  return (
    <span className="flex items-baseline">
      <span className="text-[max(12px,0.5em)]">
        {t('checkout.productSwitcher.fromPrefix')}{' '}
      </span>
      <AmountLabel
        amount={amount}
        currency={currency}
        interval={interval}
        intervalCount={intervalCount}
        mode="standard"
        locale={locale}
      />
    </span>
  )
}

interface CheckoutProductSwitcherProps {
  checkout: ProductCheckoutPublic
  update?: (
    data: schemas['CheckoutUpdatePublic'],
  ) => Promise<ProductCheckoutPublic>
  disabled?: boolean
  themePreset: ThemingPresetProps
  locale?: AcceptedLocale
}

const CheckoutProductSwitcher = ({
  checkout,
  update,
  locale = DEFAULT_LOCALE,
}: CheckoutProductSwitcherProps) => {
  const t = useTranslations(locale)

  const {
    product: selectedProduct,
    product_price: selectedPrice,
    products,
    prices: allPrices,
    currency,
  } = checkout

  // Filter prices to only show ones matching the checkout's detected currency.
  // Products with presentment currencies may have prices in multiple currencies,
  // but the switcher should only display prices in the checkout's currency.
  const prices = useMemo(() => {
    const filtered: typeof allPrices = {}
    for (const [productId, productPrices] of Object.entries(allPrices)) {
      const currencyPrices = productPrices.filter(
        (p) => p.price_currency === currency,
      )
      filtered[productId] =
        currencyPrices.length > 0 ? currencyPrices : productPrices
    }
    return filtered
  }, [allPrices, currency])

  const selectProduct = useCallback(
    (value: string) => {
      const [productId, priceId] = value.split(':')
      const product = products.find((product) => product.id === productId)
      if (product) {
        if (hasLegacyRecurringPrices(prices[product.id])) {
          update?.({
            product_id: product.id,
            product_price_id: priceId,
          })
        } else {
          update?.({ product_id: product.id })
        }
      }
    },
    [update, products, prices],
  )

  if (
    products.length === 1 &&
    !hasLegacyRecurringPrices(prices[products[0].id])
  ) {
    return null
  }

  const getDescription = (
    product: ProductCheckoutPublic['product'],
    price: schemas['ProductPrice'] | schemas['LegacyRecurringProductPrice'],
  ) => {
    const interval = isLegacyRecurringProductPrice(price)
      ? price.recurring_interval
      : product.recurring_interval
    const count = product.recurring_interval_count ?? 1

    if (interval) {
      const frequency = decapitalize(
        t(
          `checkout.pricing.everyInterval.${interval as 'day' | 'week' | 'month' | 'year'}`,
          {
            count,
          },
        ),
      )

      // We have to capitalize again since {frequency} may come first
      // in the translation string, e.g. "{frequency} gefactureerd" in Dutch
      return capitalize(
        t('checkout.productSwitcher.billedRecurring', { frequency }),
      )
    }

    return t('checkout.productSwitcher.oneTimePurchase')
  }

  const items: {
    key: string
    value: string
    productName: string
    product: ProductCheckoutPublic['product']
    price: schemas['ProductPrice'] | schemas['LegacyRecurringProductPrice']
    isSelected: boolean
  }[] = []
  for (const product of products) {
    if (hasLegacyRecurringPrices(prices[product.id])) {
      for (const price of prices[product.id]) {
        items.push({
          key: price.id,
          value: `${product.id}:${price.id}`,
          productName: product.name,
          product,
          price,
          isSelected: price.id === selectedPrice.id,
        })
      }
    } else {
      items.push({
        key: product.id,
        value: `${product.id}:${prices[product.id][0].id}`,
        productName: product.name,
        product,
        price: prices[product.id][0],
        isSelected: product.id === selectedProduct.id,
      })
    }
  }

  return (
    <RadioGroup
      value={`${selectedProduct.id}:${selectedPrice.id}`}
      onValueChange={selectProduct}
      className="dark:border-polar-700 dark:divide-polar-700 gap-0 divide-y divide-gray-200 overflow-hidden rounded-xl border border-gray-200"
    >
      {items.map((item) => (
        <label
          key={item.key}
          className={cn(
            'flex cursor-pointer items-center gap-x-3 px-4 py-3 transition-colors',
            item.isSelected
              ? 'bg-blue-50/50 dark:bg-blue-950/20'
              : 'dark:hover:bg-polar-800 hover:bg-gray-50',
          )}
          htmlFor={`product-${item.key}`}
        >
          <RadioGroupItem value={item.value} id={`product-${item.key}`} />
          <div className="min-w-0 flex-1">
            <span className="line-clamp-2 text-sm">{item.productName}</span>
            <span className="dark:text-polar-500 block text-xs text-gray-500">
              {getDescription(item.product, item.price)}
            </span>
          </div>
          <span className="dark:text-polar-400 shrink-0 text-sm text-gray-500">
            <CheckoutProductSwitcherItemPrice
              isSelected={item.isSelected}
              product={item.product}
              price={item.price}
              checkout={checkout}
              locale={locale}
            />
          </span>
        </label>
      ))}
    </RadioGroup>
  )
}

export default CheckoutProductSwitcher
