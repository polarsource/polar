'use client'

import type { CheckoutPublic } from '@polar-sh/sdk/models/components/checkoutpublic'
import type { CheckoutUpdatePublic } from '@polar-sh/sdk/models/components/checkoutupdatepublic'
import {
  RadioGroup,
  RadioGroupItem,
} from '@polar-sh/ui/components/ui/radio-group'
import { useCallback } from 'react'
import { hasLegacyRecurringPrices } from '../utils/product'
import ProductPriceLabel from './ProductPriceLabel'

interface CheckoutProductSwitcherProps {
  checkout: CheckoutPublic
  update?: (data: CheckoutUpdatePublic) => Promise<CheckoutPublic>
  disabled?: boolean
}

const CheckoutProductSwitcher = ({
  checkout,
  update,
  disabled,
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
                className={`flex cursor-pointer flex-row items-center gap-4 rounded-2xl border p-6 hover:border-blue-500 ${price.id === selectedProduct.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : ''}`}
                htmlFor={`product-${price.id}`}
              >
                <RadioGroupItem
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
            className={`flex cursor-pointer flex-row items-center gap-4 rounded-2xl border p-6 hover:border-blue-500 ${product.id === selectedProduct.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : ''}`}
            htmlFor={`product-${product.id}`}
          >
            <RadioGroupItem
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
