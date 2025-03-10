'use client'

import { isLegacyRecurringPrice } from '@/utils/product'
import { ErrorMessage } from '@hookform/error-message'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import MoneyInput from '@polar-sh/ui/components/atoms/MoneyInput'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  UseFieldArrayReturn,
  useFieldArray,
  useFormContext,
} from 'react-hook-form'
import { Section } from '../../Layout/Section'
import { ProductFormType } from './ProductForm'

export interface ProductPriceItemProps {
  index: number
  fieldArray: UseFieldArrayReturn<ProductFormType, 'prices', 'id'>
}

export const ProductPriceItem: React.FC<ProductPriceItemProps> = ({
  index,
}) => {
  const { control, register, setValue } = useFormContext<ProductFormType>()

  return (
    <div className="flex items-center gap-2">
      <input type="hidden" {...register(`prices.${index}.id`)} />
      <input type="hidden" {...register(`prices.${index}.amount_type`)} />
      <FormField
        control={control}
        name={`prices.${index}.price_amount`}
        rules={{
          required: 'This field is required',
          min: { value: 50, message: 'Price must be greater than 0.5' },
        }}
        render={({ field }) => {
          return (
            <FormItem className="grow">
              <div className="flex items-center gap-2">
                <FormControl>
                  <MoneyInput
                    name={field.name}
                    value={field.value}
                    onChange={(v) => {
                      field.onChange(v)
                      setValue(`prices.${index}.id`, '')
                    }}
                    placeholder={0}
                  />
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          )
        }}
      />
    </div>
  )
}

export interface ProductPriceCustomItemProps {
  index: number
}

export const ProductPriceCustomItem: React.FC<ProductPriceCustomItemProps> = ({
  index,
}) => {
  const { control, register, setValue } = useFormContext<ProductFormType>()

  return (
    <div className="flex items-center gap-2">
      <input type="hidden" {...register(`prices.${index}.id`)} />
      <input type="hidden" {...register(`prices.${index}.amount_type`)} />
      <FormField
        control={control}
        name={`prices.${index}.minimum_amount`}
        rules={{
          min: { value: 50, message: 'Price must be greater than $0.5' },
        }}
        render={({ field }) => {
          return (
            <FormItem>
              <FormLabel>Minimum amount</FormLabel>
              <FormControl>
                <MoneyInput
                  name={field.name}
                  value={field.value || undefined}
                  onChange={(v) => {
                    field.onChange(v)
                    setValue(`prices.${index}.id`, '')
                  }}
                  placeholder={1000}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )
        }}
      />
      <FormField
        control={control}
        name={`prices.${index}.preset_amount`}
        rules={{
          min: { value: 50, message: 'Price must be greater than $0.5' },
          max: {
            value: 1_000_000,
            message: 'Price cannot be greater than $10,000',
          },
        }}
        render={({ field }) => {
          return (
            <FormItem>
              <FormLabel>Suggested amount</FormLabel>
              <FormControl>
                <MoneyInput
                  name={field.name}
                  value={field.value || undefined}
                  onChange={(v) => {
                    field.onChange(v)
                    setValue(`prices.${index}.id`, '')
                  }}
                  placeholder={5000}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )
        }}
      />
    </div>
  )
}

export interface ProductPriceFreeItemProps {
  index: number
}

export const ProductPriceFreeItem: React.FC<ProductPriceFreeItemProps> = ({
  index,
}) => {
  const { register } = useFormContext<ProductFormType>()

  return (
    <>
      <input type="hidden" {...register(`prices.${index}.id`)} />
      <input type="hidden" {...register(`prices.${index}.amount_type`)} />
    </>
  )
}

export interface ProductPricingSectionProps {
  className?: string
  update?: boolean
  compact?: boolean
}

export const ProductPricingSection = ({
  className,
  update,
  compact,
}: ProductPricingSectionProps) => {
  const {
    control,
    formState: { errors },
    setValue,
  } = useFormContext<ProductFormType>()

  const pricesFieldArray = useFieldArray({
    control,
    name: 'prices',
  })
  const { fields: prices, replace } = pricesFieldArray

  const isLegacyRecurringProduct = useMemo(
    () => (prices as schemas['ProductPrice'][]).some(isLegacyRecurringPrice),
    [prices],
  )
  const [legacyMigration, setLegacyMigration] = useState(false)

  const [amountType, setAmountType] = useState<'fixed' | 'custom' | 'free'>(
    prices.length > 0 && (prices as schemas['ProductPrice'][])[0].amount_type
      ? (prices as schemas['ProductPrice'][])[0].amount_type
      : 'fixed',
  )

  const switchToNewPricingModel = useCallback(() => {
    setLegacyMigration(true)
    const price = prices[0] as schemas['LegacyRecurringProductPrice']
    setValue('recurring_interval', 'month')
    replace([
      {
        ...price,
        // @ts-ignore
        id: null,
        type: null,
        recurring_interval: null,
      },
    ])
  }, [])

  useEffect(() => {
    if (update) return

    if (amountType === 'fixed') {
      replace([
        {
          amount_type: 'fixed',
          price_currency: 'usd',
          price_amount: 0,
        },
      ])
    } else if (amountType === 'custom') {
      replace([
        {
          amount_type: 'custom',
          price_currency: 'usd',
        },
      ])
    } else {
      replace([
        {
          amount_type: 'free',
        },
      ])
    }
  }, [update, replace, amountType])

  return (
    <Section
      title="Pricing"
      description="Set your billing cycle and pricing model"
      className={className}
      compact={compact}
    >
      {isLegacyRecurringProduct && !legacyMigration ? (
        <div className="prose dark:bg-polar-700 dark:text-polar-500 rounded-2xl bg-gray-100 p-6 text-sm text-gray-500">
          <p>
            This product uses a deprecated pricing model with both a monthly and
            yearly pricing.
          </p>
          <p>
            To better support future pricing model, the billing cycle is now set
            at the product level, meaning you need to create a separate product
            for each billing cycle.
          </p>
          <Button type="button" size="sm" onClick={switchToNewPricingModel}>
            Switch to new pricing model
          </Button>
        </div>
      ) : (
        <div className="flex w-full flex-col gap-6">
          <FormField
            control={control}
            name="recurring_interval"
            render={({ field }) => {
              return (
                <FormItem>
                  <FormControl>
                    <Select
                      onValueChange={(value) =>
                        field.onChange(value === 'one_time' ? null : value)
                      }
                      defaultValue={
                        field.value === null ? 'one_time' : field.value
                      }
                      disabled={update && !legacyMigration}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a billing cycle" />
                      </SelectTrigger>
                      <SelectContent>
                        {!legacyMigration && (
                          <SelectItem value="one_time">
                            One-time purchase
                          </SelectItem>
                        )}
                        <SelectItem value="month">Monthly</SelectItem>
                        <SelectItem value="year">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )
            }}
          />
          <Select
            value={amountType}
            onValueChange={(value) =>
              setAmountType(value as 'fixed' | 'custom' | 'free')
            }
            disabled={update}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a product" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fixed">Fixed price</SelectItem>
              <SelectItem value="custom">Pay what you want</SelectItem>
              <SelectItem value="free">Free</SelectItem>
            </SelectContent>
          </Select>
          {prices.map((price, index) => (
            <>
              {amountType === 'fixed' && (
                <ProductPriceItem
                  key={price.id}
                  index={index}
                  fieldArray={pricesFieldArray}
                />
              )}
              {amountType === 'custom' && (
                <ProductPriceCustomItem key={price.id} index={index} />
              )}
              {amountType === 'free' && (
                <ProductPriceFreeItem key={price.id} index={index} />
              )}
            </>
          ))}
          <ErrorMessage
            errors={errors}
            name="prices"
            render={({ message }) => (
              <p className="text-destructive text-sm font-medium">{message}</p>
            )}
          />
        </div>
      )}
    </Section>
  )
}
