'use client'

import type { CheckoutPublic } from '@polar-sh/sdk/models/components/checkoutpublic'
import type { CheckoutUpdatePublic } from '@polar-sh/sdk/models/components/checkoutupdatepublic'
import type { SubscriptionRecurringInterval } from '@polar-sh/sdk/models/components/subscriptionrecurringinterval'
import MoneyInput from '@polar-sh/ui/components/atoms/MoneyInput'
import { Tabs, TabsList, TabsTrigger } from '@polar-sh/ui/components/atoms/Tabs'
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { useCallback, useMemo, useState } from 'react'
import { type SubmitHandler, useForm } from 'react-hook-form'
import useDebouncedCallback from '../hooks/debounce'
import { formatCurrencyNumber } from '../utils/money'
import { hasRecurringIntervals } from '../utils/product'
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
  const { product, productPrice } = checkout
  const [, , hasBothIntervals] = useMemo(
    () => hasRecurringIntervals(product),
    [product],
  )
  const [recurringInterval, setRecurringInterval] =
    useState<SubscriptionRecurringInterval>(
      productPrice.type === 'recurring'
        ? productPrice.recurringInterval
        : 'month',
    )

  const onRecurringIntervalChange = useCallback(
    (recurringInterval: SubscriptionRecurringInterval) => {
      setRecurringInterval(recurringInterval)
      for (const price of product.prices) {
        if (
          price.type === 'recurring' &&
          price.recurringInterval === recurringInterval
        ) {
          if (price.id === productPrice.id) {
            return
          }
          update?.({ productPriceId: price.id })
          return
        }
      }
    },
    [product, productPrice, update],
  )

  const form = useForm<{ amount: number }>({
    defaultValues: { amount: checkout.amount || 0 },
  })
  const { control, handleSubmit, setValue, trigger } = form
  const onAmountChangeSubmit: SubmitHandler<{ amount: number }> = useCallback(
    async ({ amount }) => {
      update?.({ amount })
    },
    [update],
  )

  const submitAmountUpdate = () => {
    handleSubmit(onAmountChangeSubmit)()
  }

  const debouncedAmountUpdate = useDebouncedCallback(
    async () => {
      const isValid = await trigger('amount')
      if (isValid) {
        submitAmountUpdate()
      }
    },
    600,
    [onAmountChangeSubmit, submitAmountUpdate, trigger],
  )

  const onAmountChange = (amount: number) => {
    setValue('amount', amount)
    debouncedAmountUpdate()
  }

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
      {!disabled && hasBothIntervals && (
        <Tabs
          onValueChange={onRecurringIntervalChange as (value: string) => void}
          value={recurringInterval}
        >
          <TabsList className="dark:bg-polar-700 w-full flex-row rounded-full bg-gray-200">
            {[
              ['month', 'Monthly Billing'],
              ['year', 'Yearly Billing'],
            ].map(([value, label]) => {
              return (
                <TabsTrigger
                  key={value}
                  className="dark:data-[state=active]:bg-polar-800 w-1/2 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                  value={value}
                  size="small"
                >
                  {label}
                </TabsTrigger>
              )
            })}
          </TabsList>
        </Tabs>
      )}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-light">
          {productPrice.amountType !== 'custom' && (
            <ProductPriceLabel price={productPrice} />
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
                  <form
                    className="flex w-full flex-col gap-3"
                    onSubmit={submitAmountUpdate}
                  >
                    <FormLabel>
                      Name a fair price{' '}
                      <span className="text-gray-400">
                        ({customAmountMinLabel} minimum)
                      </span>
                    </FormLabel>
                    <div className="flex flex-row items-center gap-2">
                      <FormField
                        control={control}
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
                                onChange={onAmountChange}
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
        <p className="dark:text-polar-500 text-sm text-gray-400">
          Before VAT and taxes
        </p>
      </div>
    </div>
  )
}

export default CheckoutPricing
