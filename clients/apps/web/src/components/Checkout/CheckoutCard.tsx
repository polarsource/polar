'use client'

import { resolveBenefitIcon } from '@/components/Benefit/utils'
import ProductPriceLabel from '@/components/Products/ProductPriceLabel'
import SubscriptionTierRecurringIntervalSwitch from '@/components/Subscriptions/SubscriptionTierRecurringIntervalSwitch'
import { useRecurringInterval } from '@/hooks/products'
import {
  CheckoutPublic,
  CheckoutUpdatePublic,
  SubscriptionRecurringInterval,
} from '@polar-sh/sdk'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import { useCallback } from 'react'

export interface CheckoutCardProps {
  checkout: CheckoutPublic
  onCheckoutUpdate?: (body: CheckoutUpdatePublic) => Promise<CheckoutPublic>
  disabled?: boolean
}

export const CheckoutCard = ({
  checkout,
  onCheckoutUpdate,
  disabled,
}: CheckoutCardProps) => {
  const { product, product_price } = checkout
  const [, , hasBothIntervals] = useRecurringInterval([product])

  const onRecurringIntervalChange = useCallback(
    async (recurringInterval: SubscriptionRecurringInterval) => {
      for (const price of product.prices) {
        if (
          price.type === 'recurring' &&
          price.recurring_interval === recurringInterval
        ) {
          await onCheckoutUpdate?.({ product_price_id: price.id })
          return
        }
      }
    },
    [product, onCheckoutUpdate],
  )

  return (
    <div className="flex w-full flex-col items-center gap-8">
      {!disabled && hasBothIntervals && (
        <SubscriptionTierRecurringIntervalSwitch
          recurringInterval={
            product_price.type === 'recurring'
              ? product_price.recurring_interval
              : SubscriptionRecurringInterval.MONTH
          }
          onChange={onRecurringIntervalChange}
        />
      )}
      <ShadowBox className="dark:bg-polar-950 flex flex-col gap-8 bg-gray-100 md:ring-gray-100">
        <h2 className="text-xl">{product.name}</h2>
        <div className="flex flex-col gap-4">
          <h1 className="text-4xl font-light">
            <ProductPriceLabel price={product_price} />
          </h1>
          <p className="dark:text-polar-500 text-sm text-gray-400">
            Before VAT and taxes
          </p>
        </div>
        {product.benefits.length > 0 ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <h1 className="font-medium dark:text-white">Included</h1>
            </div>
            <div className="flex flex-col gap-y-2">
              {product.benefits.map((benefit) => (
                <div
                  key={benefit.id}
                  className="flex flex-row items-center gap-x-2"
                >
                  {resolveBenefitIcon(benefit, 'small', 'h-4 w-4')}
                  <span className="text-sm">{benefit.description}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <></>
        )}
      </ShadowBox>
    </div>
  )
}
