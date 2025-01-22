'use client'

import { BenefitList } from '@/components/Products/BenefitList'
import ProductPriceLabel from '@/components/Products/ProductPriceLabel'
import SubscriptionTierRecurringIntervalSwitch from '@/components/Subscriptions/SubscriptionTierRecurringIntervalSwitch'
import useDebouncedCallback from '@/hooks/utils'
import { hasIntervals } from '@/utils/product'
import { AttachMoneyOutlined } from '@mui/icons-material'
import {
  CheckoutPublic,
  CheckoutUpdatePublic,
  SubscriptionRecurringInterval,
} from '@polar-sh/api'
import { formatCurrencyAndAmount } from '@polarkit/lib/money'
import MoneyInput from 'polarkit/components/atoms/money-input'
import ShadowBox from 'polarkit/components/atoms/shadowbox'
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from 'polarkit/components/ui/form'
import { useCallback, useMemo, useState } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'

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
  const { product, product_price: productPrice } = checkout
  const [, , hasBothIntervals] = useMemo(() => hasIntervals(product), [product])
  const [recurringInterval, setRecurringInterval] =
    useState<SubscriptionRecurringInterval>(
      productPrice.type === 'recurring'
        ? productPrice.recurring_interval
        : SubscriptionRecurringInterval.MONTH,
    )

  const onRecurringIntervalChange = useCallback(
    (recurringInterval: SubscriptionRecurringInterval) => {
      setRecurringInterval(recurringInterval)
      for (const price of product.prices) {
        if (
          price.type === 'recurring' &&
          price.recurring_interval === recurringInterval
        ) {
          if (price.id === productPrice.id) {
            return
          }
          onCheckoutUpdate?.({ product_price_id: price.id })
          return
        }
      }
    },
    [product, productPrice, onCheckoutUpdate],
  )

  const form = useForm<{ amount: number }>({
    defaultValues: { amount: checkout.amount || 0 },
  })
  const { control, handleSubmit, setValue, trigger } = form
  const onAmountChangeSubmit: SubmitHandler<{ amount: number }> = useCallback(
    async ({ amount }) => {
      onCheckoutUpdate?.({ amount })
    },
    [onCheckoutUpdate],
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
  if (productPrice.amount_type === 'custom') {
    customAmountMinLabel = formatCurrencyAndAmount(
      productPrice.minimum_amount || 50,
      checkout.currency || 'usd',
    )

    if (productPrice.maximum_amount) {
      customAmountMaxLabel = formatCurrencyAndAmount(
        productPrice.maximum_amount,
        checkout.currency || 'usd',
      )
    }
  }

  return (
    <ShadowBox className="dark:bg-polar-800 dark:border-polar-700 flex flex-col gap-6 rounded-3xl bg-gray-50">
      <h2 className="text-lg font-medium">{product.name}</h2>
      {!disabled && hasBothIntervals && (
        <SubscriptionTierRecurringIntervalSwitch
          value={recurringInterval}
          onChange={onRecurringIntervalChange}
          tabsTriggerClassName="w-1/2 py-2 dark:data-[state=active]:bg-polar-800 data-[state=active]:bg-white data-[state=active]:shadow-sm"
          tabsListClassName="w-full flex-row dark:bg-polar-700 bg-gray-200 rounded-full"
        />
      )}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-light">
          {productPrice.amount_type !== 'custom' && (
            <ProductPriceLabel price={productPrice} />
          )}
          {productPrice.amount_type === 'custom' && (
            <>
              {disabled ? (
                formatCurrencyAndAmount(
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
                            value: productPrice.minimum_amount || 50,
                            message: `Price must be greater than ${customAmountMinLabel}`,
                          },
                          ...(productPrice.maximum_amount
                            ? {
                                max: {
                                  value: productPrice.maximum_amount,
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
                                preSlot={
                                  <AttachMoneyOutlined fontSize="small" />
                                }
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
      {product.benefits.length > 0 ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="font-medium dark:text-white">Included</h1>
          </div>
          <div className="flex flex-col gap-y-2">
            <BenefitList benefits={product.benefits} toggle={true} />
          </div>
        </div>
      ) : (
        <></>
      )}
    </ShadowBox>
  )
}
