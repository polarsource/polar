'use client'

import type { CheckoutPublic } from '@polar-sh/sdk/models/components/checkoutpublic'
import type { CheckoutUpdatePublic } from '@polar-sh/sdk/models/components/checkoutupdatepublic'
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
                  `flex cursor-pointer flex-row items-center gap-4 border p-6 transition-colors`,
                  price.id === selectedProduct.id
                    ? themePreset.polar.checkoutProductSwitchSelected
                    : '',
                )}
                htmlFor={`product-${price.id}`}
              >
                <RadioGroupItem
                  className="hidden"
                  value={`${product.id}:${price.id}`}
                  id={`product-${price.id}`}
                />
                <div className="flex grow flex-row items-center justify-between text-sm">
                  <div>{product.name}</div>
                  <ProductPriceLabel product={product} price={price} />
                </div>
              </label>
            ))}
          </>
        ) : (
          <label
            key={product.id}
            className={cn(
              themePreset.polar.checkoutProductSwitch,
              `flex cursor-pointer flex-row items-center gap-4 border p-6 transition-colors`,
              product.id === selectedProduct.id
                ? themePreset.polar.checkoutProductSwitchSelected
                : '',
            )}
            htmlFor={`product-${product.id}`}
          >
            <RadioGroupItem
              className="hidden"
              value={`${product.id}:${product.prices[0].id}`}
              id={`product-${product.id}`}
            />
            <div className="flex grow flex-row items-center justify-between text-sm">
              <div>{product.name}</div>
              <ProductPriceLabel product={product} price={product.prices[0]} />
            </div>
          </label>
        ),
      )}
    </RadioGroup>
  )
}

export default CheckoutProductSwitcher
