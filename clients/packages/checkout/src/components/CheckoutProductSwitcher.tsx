'use client'

import {
  DEFAULT_LOCALE,
  useTranslations,
  type AcceptedLocale,
} from '@polar-sh/i18n'
import type { CheckoutUpdatePublic } from '@polar-sh/sdk/models/components/checkoutupdatepublic'
import { LegacyRecurringProductPrice } from '@polar-sh/sdk/models/components/legacyrecurringproductprice.js'
import type { ProductPrice } from '@polar-sh/sdk/models/components/productprice.js'
import {
  RadioGroup,
  RadioGroupItem,
} from '@polar-sh/ui/components/ui/radio-group'
import { ThemingPresetProps } from '@polar-sh/ui/hooks/theming'
import { cn } from '@polar-sh/ui/lib/utils'
import { Fragment, useCallback, useMemo } from 'react'
import type { ProductCheckoutPublic } from '../guards'
import { hasLegacyRecurringPrices } from '../utils/product'
import { capitalize, decapitalize } from '../utils/string'
import AmountLabel from './AmountLabel'
import ProductPriceLabel from './ProductPriceLabel'

interface CheckoutProductSwitcherProps {
  checkout: ProductCheckoutPublic
  update?: (data: CheckoutUpdatePublic) => Promise<ProductCheckoutPublic>
  disabled?: boolean
  themePreset: ThemingPresetProps
  locale?: AcceptedLocale
  flattenExperiment?: 'treatment' | 'control'
}

const CheckoutProductSwitcher = ({
  checkout,
  update,
  locale = DEFAULT_LOCALE,
  flattenExperiment,
}: CheckoutProductSwitcherProps) => {
  const t = useTranslations(locale)

  const {
    product: selectedProduct,
    productPrice: selectedPrice,
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
        (p) => p.priceCurrency === currency,
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
            productId: product.id,
            productPriceId: priceId,
          })
        } else {
          update?.({ productId: product.id })
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
    price: ProductPrice | LegacyRecurringProductPrice,
  ) => {
    const interval = hasLegacyRecurringPrices(prices[product.id])
      ? price.recurringInterval
      : product.recurringInterval
    const count = product.recurringIntervalCount ?? 1

    if (interval) {
      if (!['day', 'week', 'month', 'year'].includes(interval)) {
        throw new Error(`Unsupported interval: ${interval}`)
      }

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

  const isFlat = flattenExperiment === 'treatment'

  if (isFlat) {
    const items: {
      key: string
      value: string
      productName: string
      product: ProductCheckoutPublic['product']
      price: ProductPrice | LegacyRecurringProductPrice
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
              {item.isSelected && item.price.amountType === 'seat_based' ? (
                <AmountLabel
                  amount={checkout.netAmount || 0}
                  currency={item.price.priceCurrency}
                  interval={item.product.recurringInterval}
                  intervalCount={item.product.recurringIntervalCount}
                  mode="compact"
                  locale={locale}
                />
              ) : (
                <ProductPriceLabel
                  product={item.product}
                  price={item.price}
                  locale={locale}
                />
              )}
            </span>
          </label>
        ))}
      </RadioGroup>
    )
  }

  return (
    <RadioGroup
      value={`${selectedProduct.id}:${selectedPrice.id}`}
      onValueChange={selectProduct}
      className="grid grid-cols-2 gap-2"
    >
      {products.map((product) =>
        hasLegacyRecurringPrices(prices[product.id]) ? (
          <Fragment key={product.id}>
            {prices[product.id].map((price) => (
              <label
                key={price.id}
                className={cn(
                  `dark:md:bg-polar-950 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border p-3 text-center transition-colors hover:border-blue-500 md:bg-white dark:hover:border-blue-500`,
                  price.id === selectedPrice.id
                    ? 'border-blue-500 dark:border-blue-500'
                    : 'dark:border-polar-700 border-gray-200',
                )}
                htmlFor={`product-${price.id}`}
              >
                <RadioGroupItem
                  value={`${product.id}:${price.id}`}
                  id={`product-${price.id}`}
                  className="sr-only"
                />
                <span className="text-sm font-medium">{product.name}</span>
                <ProductPriceLabel product={product} price={price} />
                <span className="dark:text-polar-500 text-xs text-gray-500">
                  {getDescription(product, price)}
                </span>
              </label>
            ))}
          </Fragment>
        ) : (
          <label
            key={product.id}
            className={cn(
              `dark:md:bg-polar-950 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border p-3 text-center transition-colors hover:border-blue-500 md:bg-white dark:hover:border-blue-500`,
              product.id === selectedProduct.id
                ? 'border-blue-500 dark:border-blue-500'
                : 'dark:border-polar-700 border-gray-200',
            )}
            htmlFor={`product-${product.id}`}
          >
            <RadioGroupItem
              value={`${product.id}:${prices[product.id][0].id}`}
              id={`product-${product.id}`}
              className="sr-only"
            />
            <span className="text-sm font-medium">{product.name}</span>
            <ProductPriceLabel
              product={product}
              price={prices[product.id][0]}
            />
            <span className="dark:text-polar-500 text-xs text-gray-500">
              {getDescription(product, prices[product.id][0])}
            </span>
          </label>
        ),
      )}
    </RadioGroup>
  )
}

export default CheckoutProductSwitcher
