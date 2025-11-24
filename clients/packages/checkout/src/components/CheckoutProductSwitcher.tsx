'use client'

import type { CheckoutUpdatePublic } from '@polar-sh/sdk/models/components/checkoutupdatepublic'
import { LegacyRecurringProductPrice } from '@polar-sh/sdk/models/components/legacyrecurringproductprice.js'
import type { ProductPrice } from '@polar-sh/sdk/models/components/productprice.js'
import {
  RadioGroup,
  RadioGroupItem,
} from '@polar-sh/ui/components/ui/radio-group'
import { ThemingPresetProps } from '@polar-sh/ui/hooks/theming'
import { cn } from '@polar-sh/ui/lib/utils'
import { Fragment, useCallback } from 'react'
import type { ProductCheckoutPublic } from '../guards'
import {
  formatRecurringFrequency,
  hasLegacyRecurringPrices,
} from '../utils/product'
import ProductPriceLabel from './ProductPriceLabel'

interface CheckoutProductSwitcherProps {
  checkout: ProductCheckoutPublic
  update?: (data: CheckoutUpdatePublic) => Promise<ProductCheckoutPublic>
  disabled?: boolean
  themePreset: ThemingPresetProps
}

const CheckoutProductSwitcher = ({
  checkout,
  update,
  themePreset,
}: CheckoutProductSwitcherProps) => {
  const {
    product: selectedProduct,
    productPrice: selectedPrice,
    products,
    prices,
  } = checkout

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
    [update, products],
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
    const intervalCount = product.recurringIntervalCount

    if (interval) {
      const recurringLabel = formatRecurringFrequency(interval, intervalCount)
      return `Billed ${recurringLabel}`
    }

    return `One-time purchase`
  }

  return (
    <RadioGroup
      value={`${selectedProduct.id}:${selectedPrice.id}`}
      onValueChange={selectProduct}
      className="flex flex-col gap-2"
    >
      {products.map((product) =>
        hasLegacyRecurringPrices(prices[product.id]) ? (
          <Fragment key={product.id}>
            {prices[product.id].map((price) => (
              <label
                key={price.id}
                className={cn(
                  `dark:divide-polar-700 dark:md:bg-polar-950 flex cursor-pointer flex-col divide-y divide-gray-200 rounded-2xl border shadow-xs transition-colors hover:border-blue-500 md:bg-white md:shadow-none dark:hover:border-blue-500`,
                  price.id === selectedProduct.id
                    ? 'border-blue-500 dark:border-blue-500'
                    : '',
                )}
                htmlFor={`product-${price.id}`}
              >
                <div className="flex flex-row items-center gap-4 p-4">
                  <RadioGroupItem
                    value={`${product.id}:${price.id}`}
                    id={`product-${price.id}`}
                  />
                  <div className="flex grow flex-row items-center justify-between text-sm">
                    <div>{product.name}</div>
                    <ProductPriceLabel product={product} price={price} />
                  </div>
                </div>
                <div className="flex grow flex-row items-center justify-between p-4 text-sm">
                  <p className="dark:text-polar-500 text-gray-500">
                    {getDescription(product, price)}
                  </p>
                </div>
              </label>
            ))}
          </Fragment>
        ) : (
          <label
            key={product.id}
            className={cn(
              `dark:divide-polar-700 dark:md:bg-polar-950 flex cursor-pointer flex-col divide-y divide-gray-200 rounded-2xl border shadow-xs transition-colors hover:border-blue-500 md:bg-white md:shadow-none dark:hover:border-blue-500`,
              product.id === selectedProduct.id
                ? 'border-blue-500 dark:border-blue-500'
                : '',
            )}
            htmlFor={`product-${product.id}`}
          >
            <div className="flex flex-row items-center gap-4 p-4">
              <RadioGroupItem
                value={`${product.id}:${prices[product.id][0].id}`}
                id={`product-${product.id}`}
              />
              <div className="flex grow flex-row items-center justify-between text-sm">
                <div>{product.name}</div>
                <ProductPriceLabel
                  product={product}
                  price={prices[product.id][0]}
                />
              </div>
            </div>
            <div className="flex grow flex-row items-center justify-between p-4 text-sm">
              <p className="dark:text-polar-500 text-gray-500">
                {getDescription(product, prices[product.id][0])}
              </p>
            </div>
          </label>
        ),
      )}
    </RadioGroup>
  )
}

export default CheckoutProductSwitcher
