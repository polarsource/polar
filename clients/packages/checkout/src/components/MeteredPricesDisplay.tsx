'use client'

import type { ProductPrice } from '@polar-sh/sdk/models/components/productprice'
import { useMemo } from 'react'
import { ProductCheckoutPublic } from '../guards'
import { getMeteredPrices } from '../utils/product'
import ProductPriceLabel from './ProductPriceLabel'

const GaugeIcon = ({ className }: { className?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m12 14 4-4" />
      <path d="M3.34 19a10 10 0 1 1 17.32 0" />
    </svg>
  )
}

interface MeteredPricesDisplayProps {
  checkout: ProductCheckoutPublic
}

const MeteredPricesDisplay = ({ checkout }: MeteredPricesDisplayProps) => {
  const { product, prices, productPrice } = checkout

  // Get the metered prices, minus the currently selected one, in case there are only metered prices
  const meteredPrices = useMemo(
    () =>
      getMeteredPrices(prices[product.id]).filter(
        (p) => p.id !== productPrice.id,
      ),
    [product, productPrice],
  )

  if (meteredPrices.length === 0) {
    return null
  }

  return (
    <div className="text-sm">
      <h2 className="mb-2 text-base font-medium">+ Additional metered usage</h2>
      {meteredPrices.map((price) => (
        <div
          key={price.id}
          className="dark:text-polar-100 flex flex-row items-center gap-x-2 text-sm text-gray-600"
        >
          <GaugeIcon className="h-4 w-4" />
          <ProductPriceLabel product={product} price={price as ProductPrice} />
        </div>
      ))}
    </div>
  )
}

export default MeteredPricesDisplay
