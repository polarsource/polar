'use client'

import type { CheckoutPublic } from '@polar-sh/sdk/models/components/checkoutpublic'
import type { CheckoutUpdatePublic } from '@polar-sh/sdk/models/components/checkoutupdatepublic'
import MoneyInput from '@polar-sh/ui/components/atoms/MoneyInput'
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useDebouncedCallback } from '../hooks/debounce'
import { getDiscountDisplay } from '../utils/discount'
import { formatCurrencyNumber } from '../utils/money'
import {
  getMeteredPrices,
  hasRecurringIntervals,
  isLegacyRecurringPrice,
} from '../utils/product'
import AmountLabel from './AmountLabel'
import ProductPriceLabel from './ProductPriceLabel'

const DollarSignIcon = ({ className }: { className?: string }) => {
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
      <line x1="12" x2="12" y1="2" y2="22" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  )
}

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

const CheckoutProductAmountLabel = ({
  checkout,
}: {
  checkout: CheckoutPublic
}) => {
  const { product, productPrice, discount } = checkout
  if (!discount || productPrice.amountType !== 'fixed') {
    return <ProductPriceLabel product={product} price={productPrice} />
  }

  return (
    <div className="flex flex-row justify-between">
      <AmountLabel
        amount={checkout.netAmount}
        currency={checkout.currency || 'usd'}
        interval={
          isLegacyRecurringPrice(productPrice)
            ? productPrice.recurringInterval
            : product.recurringInterval
        }
      />
      <div className="flex flex-row items-center gap-x-2 text-lg">
        <div className="text-gray-400 line-through">
          <ProductPriceLabel product={product} price={productPrice} />
        </div>

        <div className="relative rounded bg-gradient-to-br from-gray-400 to-gray-500 px-3 py-0.5 text-center text-sm text-white shadow-md dark:from-gray-600 dark:to-gray-700">
          <span>{getDiscountDisplay(discount)}</span>

          <div className="dark:bg-polar-800 absolute left-0 top-1/2 -ml-1 flex h-2 w-2 -translate-y-1/2 transform rounded-full bg-gray-50"></div>
          <div className="dark:bg-polar-800 absolute right-0 top-1/2 -mr-1 flex h-2 w-2 -translate-y-1/2 transform rounded-full bg-gray-50"></div>
        </div>
      </div>
    </div>
  )
}

interface CheckoutPricingProps {
  checkout: CheckoutPublic
  update?: (data: CheckoutUpdatePublic) => Promise<CheckoutPublic>
  disabled?: boolean
}

const CheckoutPricing = ({
  checkout,
  update,
  disabled,
}: CheckoutPricingProps) => {
  const { product, productPrice, amount } = checkout
  const [, , hasBothIntervals] = useMemo(
    () => hasRecurringIntervals(product),
    [product],
  )

  // Get the metered prices, minus the currently selected one, in case there are only metered prices
  const meteredPrices = useMemo(
    () => getMeteredPrices(product).filter((p) => p.id !== productPrice.id),
    [product, productPrice],
  )

  const form = useForm<{ amount: number }>({
    defaultValues: { amount: amount || 0 },
  })
  const { control, trigger, reset, watch } = form

  const debouncedAmountUpdate = useDebouncedCallback(
    async (amount: number) => {
      const isValid = await trigger('amount')
      if (isValid) {
        update?.({ amount })
      }
    },
    600,
    [update, trigger],
  )

  useEffect(() => {
    const subscription = watch(async (value, { name }) => {
      if (name === 'amount' && value.amount !== undefined) {
        debouncedAmountUpdate(value.amount)
      }
    })
    return () => subscription.unsubscribe()
  }, [watch, debouncedAmountUpdate])

  useEffect(() => {
    reset({ amount: amount || 0 })
  }, [amount, reset])

  let customAmountMinLabel = null
  let customAmountMaxLabel = null
  if (productPrice.amountType === 'custom') {
    customAmountMinLabel = formatCurrencyNumber(
      productPrice.minimumAmount || 50,
      checkout.currency || 'usd',
    )

    if (productPrice.maximumAmount) {
      customAmountMaxLabel = formatCurrencyNumber(
        productPrice.maximumAmount,
        checkout.currency || 'usd',
      )
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-light">
          {productPrice.amountType !== 'custom' && (
            <CheckoutProductAmountLabel checkout={checkout} />
          )}
          {productPrice.amountType === 'custom' && (
            <>
              {disabled ? (
                formatCurrencyNumber(
                  checkout.amount || 0,
                  checkout.currency || 'usd',
                )
              ) : (
                <Form {...form}>
                  <form className="flex w-full flex-col gap-3">
                    <FormLabel>
                      Name a fair price{' '}
                      <span className="text-gray-400">
                        ({customAmountMinLabel} minimum)
                      </span>
                    </FormLabel>
                    <div className="flex flex-row items-center gap-2">
                      <FormField
                        control={control}
                        shouldUnregister={true}
                        name="amount"
                        rules={{
                          min: {
                            value: productPrice.minimumAmount || 50,
                            message: `Price must be greater than ${customAmountMinLabel}`,
                          },
                          ...(productPrice.maximumAmount
                            ? {
                                max: {
                                  value: productPrice.maximumAmount,
                                  message: `Price must be less than ${customAmountMaxLabel}`,
                                },
                              }
                            : {}),
                        }}
                        render={({ field }) => {
                          return (
                            <FormItem className="w-full">
                              <MoneyInput
                                className="text-md dark:border-polar-600"
                                name={field.name}
                                value={field.value || undefined}
                                onChange={field.onChange}
                                placeholder={0}
                                disabled={field.disabled}
                                preSlot={<DollarSignIcon className="h-4 w-4" />}
                              />
                              <FormMessage />
                            </FormItem>
                          )
                        }}
                      />
                    </div>
                  </form>
                </Form>
              )}
            </>
          )}
        </h1>
        {meteredPrices.length > 0 && (
          <div className="text-sm">
            <h2 className="mb-2 font-semibold">+ additional metered usage</h2>
            {meteredPrices.map((price) => (
              <div
                key={price.id}
                className="dark:text-polar-500 flex flex-row gap-1 text-sm text-gray-400"
              >
                <GaugeIcon className="h-4 w-4" />
                <ProductPriceLabel product={product} price={price} />
              </div>
            ))}
          </div>
        )}
        <p className="dark:text-polar-500 text-sm text-gray-400">
          Before VAT and taxes
        </p>
      </div>
    </div>
  )
}

export default CheckoutPricing
