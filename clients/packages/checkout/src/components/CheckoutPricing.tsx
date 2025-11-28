'use client'

import type { CheckoutPublic } from '@polar-sh/sdk/models/components/checkoutpublic'
import type { CheckoutUpdatePublic } from '@polar-sh/sdk/models/components/checkoutupdatepublic'
import { ProductCheckoutPublic } from '../guards'
import { getDiscountDisplay } from '../utils/discount'
import { formatCurrencyNumber } from '../utils/money'
import { isLegacyRecurringPrice } from '../utils/product'
import AmountLabel from './AmountLabel'
import MeteredPricesDisplay from './MeteredPricesDisplay'
import ProductPriceLabel from './ProductPriceLabel'

const CheckoutProductAmountLabel = ({
  checkout,
}: {
  checkout: ProductCheckoutPublic
}) => {
  const { product, productPrice, discount } = checkout
  if (!discount || productPrice.amountType !== 'fixed') {
    return <ProductPriceLabel product={product} price={productPrice} />
  }

  return (
    <div className="flex flex-row justify-between">
      <AmountLabel
        amount={checkout.netAmount}
        currency={checkout.currency}
        interval={
          isLegacyRecurringPrice(productPrice)
            ? productPrice.recurringInterval
            : product.recurringInterval
        }
        intervalCount={product.recurringIntervalCount}
      />
      <div className="flex flex-row items-center gap-x-2 text-lg">
        <div className="text-gray-400 line-through">
          <ProductPriceLabel product={product} price={productPrice} />
        </div>

        <div className="relative rounded-xs bg-linear-to-br from-gray-400 to-gray-500 px-3 py-0.5 text-center text-sm text-white shadow-md dark:from-gray-600 dark:to-gray-700">
          <span>{getDiscountDisplay(discount)}</span>

          <div className="dark:bg-polar-800 absolute top-1/2 left-0 -ml-1 flex h-2 w-2 -translate-y-1/2 transform rounded-full bg-gray-50"></div>
          <div className="dark:bg-polar-800 absolute top-1/2 right-0 -mr-1 flex h-2 w-2 -translate-y-1/2 transform rounded-full bg-gray-50"></div>
        </div>
      </div>
    </div>
  )
}

interface CheckoutPricingProps {
  checkout: ProductCheckoutPublic
  update?: (data: CheckoutUpdatePublic) => Promise<CheckoutPublic>
  disabled?: boolean
}

const CheckoutPricing = ({
  checkout,
  update,
  disabled,
}: CheckoutPricingProps) => {
  const { product, productPrice, amount } = checkout

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-light">
          {productPrice.amountType !== 'custom' ? (
            <CheckoutProductAmountLabel checkout={checkout} />
          ) : (
            formatCurrencyNumber(amount, productPrice.priceCurrency, 0)
          )}
        </h1>

        <MeteredPricesDisplay checkout={checkout} />
      </div>
    </div>
  )
}

export default CheckoutPricing
