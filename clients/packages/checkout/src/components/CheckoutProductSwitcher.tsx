'use client'

import type { CheckoutProduct } from '@polar-sh/sdk/models/components/checkoutproduct.js'
import type { CheckoutPublic } from '@polar-sh/sdk/models/components/checkoutpublic'
import type { CheckoutUpdatePublic } from '@polar-sh/sdk/models/components/checkoutupdatepublic'
import { LegacyRecurringProductPrice } from '@polar-sh/sdk/models/components/legacyrecurringproductprice.js'
import type { ProductPrice } from '@polar-sh/sdk/models/components/productprice.js'
import {
  RadioGroup,
  RadioGroupItem,
} from '@polar-sh/ui/components/ui/radio-group'
import { ThemingPresetProps } from '@polar-sh/ui/hooks/theming'
import { cn } from '@polar-sh/ui/lib/utils'
import { useCallback } from 'react'
import { hasLegacyRecurringPrices } from '../utils/product'
import ProductPriceLabel from './ProductPriceLabel'

interface CheckoutProductSwitcherProps {
  checkout: CheckoutPublic
  update?: (data: CheckoutUpdatePublic) => Promise<CheckoutPublic>
  disabled?: boolean
  themePreset: ThemingPresetProps
}

const CheckoutProductSwitcher = ({
  checkout,
  update,
  disabled,
  themePreset,
}: CheckoutProductSwitcherProps) => {
  const {
    product: selectedProduct,
    productPrice: selectedPrice,
    products,
  } = checkout

  const selectProduct = useCallback(
    (value: string) => {
      const [productId, priceId] = value.split(':')
      const product = products.find((product) => product.id === productId)
      if (product) {
        if (hasLegacyRecurringPrices(product)) {
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

  if (products.length === 1 && !hasLegacyRecurringPrices(products[0])) {
    return null
  }

  const getDescription = (
    product: CheckoutProduct,
    price: ProductPrice | LegacyRecurringProductPrice,
  ) => {
    let recurringLabel = ''
    if (price.recurringInterval === 'day') {
      recurringLabel = 'daily'
    } else if (price.recurringInterval === 'week') {
      recurringLabel = 'weekly'
    } else if (price.recurringInterval === 'month') {
      recurringLabel = 'monthly'
    } else if (price.recurringInterval === 'year') {
      recurringLabel = 'yearly'
    }

    if (product.trialDays) {
      return `${product.trialDays} day trial — then billed ${recurringLabel}`
    }

    if (price.recurringInterval) {
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
        hasLegacyRecurringPrices(product) ? (
          <>
            {product.prices.map((price) => (
              <label
                key={price.id}
                className={cn(
                  themePreset.polar.checkoutProductSwitch,
                  `flex cursor-pointer flex-col border transition-colors`,
                  price.id === selectedProduct.id
                    ? themePreset.polar.checkoutProductSwitchSelected
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
          </>
        ) : (
          <label
            key={product.id}
            className={cn(
              themePreset.polar.checkoutProductSwitch,
              `flex cursor-pointer flex-col border transition-colors`,
              product.id === selectedProduct.id
                ? themePreset.polar.checkoutProductSwitchSelected
                : '',
            )}
            htmlFor={`product-${product.id}`}
          >
            <div className="flex flex-row items-center gap-4 p-4">
              <RadioGroupItem
                value={`${product.id}:${product.prices[0].id}`}
                id={`product-${product.id}`}
              />
              <div className="flex grow flex-row items-center justify-between text-sm">
                <div>{product.name}</div>
                <ProductPriceLabel
                  product={product}
                  price={product.prices[0]}
                />
              </div>
            </div>
            <div className="flex grow flex-row items-center justify-between p-4 text-sm">
              <p className="dark:text-polar-500 text-gray-500">
                {getDescription(product, product.prices[0])}
              </p>
            </div>
          </label>
        ),
      )}
    </RadioGroup>
  )
}

export default CheckoutProductSwitcher
