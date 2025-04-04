'use client'

import { usePostHog } from '@/hooks/posthog'
import { useMeters } from '@/hooks/queries/meters'
import { isLegacyRecurringPrice, isStaticPrice } from '@/utils/product'
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import React, { useCallback, useMemo, useState } from 'react'
import { useFieldArray, useFormContext } from 'react-hook-form'
import { Section } from '../../Layout/Section'
import { ProductFormType } from './ProductForm'

export interface ProductPriceFixedItemProps {
  index: number
}

export const ProductPriceFixedItem: React.FC<ProductPriceFixedItemProps> = ({
  index,
}) => {
  const { control, setValue } = useFormContext<ProductFormType>()

  return (
    <>
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
    </>
  )
}

export interface ProductPriceCustomItemProps {
  index: number
}

export const ProductPriceCustomItem: React.FC<ProductPriceCustomItemProps> = ({
  index,
}) => {
  const { control, setValue } = useFormContext<ProductFormType>()

  return (
    <div className="flex w-40 flex-col gap-4">
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

export const ProductPriceFreeItem: React.FC<ProductPriceFreeItemProps> = () => {
  return <></>
}

export interface ProductPriceMeteredUnitItemProps {
  organization: schemas['Organization']
  index: number
}

export const ProductPriceMeteredUnitItem: React.FC<
  ProductPriceMeteredUnitItemProps
> = ({ organization, index }) => {
  const { control, setValue } = useFormContext<ProductFormType>()
  const { data: meters } = useMeters(organization.id, {
    sorting: ['name'],
  })

  return (
    <>
      {meters && meters.items && (
        <FormField
          control={control}
          name={`prices.${index}.meter_id`}
          rules={{
            required: 'This field is required',
          }}
          render={({ field }) => {
            return (
              <FormItem>
                <FormLabel>Meter</FormLabel>
                <FormControl>
                  <Select
                    {...field}
                    onValueChange={(v) => {
                      field.onChange(v)
                      setValue(`prices.${index}.id`, '')
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a meter" />
                    </SelectTrigger>
                    <SelectContent>
                      {meters.items.map((meter) => (
                        <SelectItem key={meter.id} value={meter.id}>
                          {meter.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )
          }}
        />
      )}
      <FormField
        control={control}
        name={`prices.${index}.unit_amount`}
        rules={{
          min: 0,
          required: 'This field is required',
        }}
        render={({ field }) => {
          return (
            <FormItem>
              <FormLabel>Amount per unit</FormLabel>
              <FormControl>
                <MoneyInput
                  {...field}
                  name={field.name}
                  value={field.value || undefined}
                  onChange={(v) => {
                    field.onChange(v)
                    setValue(`prices.${index}.id`, '')
                  }}
                  placeholder={10}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )
        }}
      />
      <FormField
        control={control}
        name={`prices.${index}.cap_amount`}
        render={({ field }) => {
          return (
            <FormItem>
              <FormLabel>Cap amount</FormLabel>
              <FormControl>
                <MoneyInput
                  {...field}
                  name={field.name}
                  value={field.value || undefined}
                  onChange={(v) => {
                    field.onChange(v)
                    setValue(`prices.${index}.id`, '')
                  }}
                  placeholder={10000}
                />
              </FormControl>
              <FormDescription>
                Optional maximum amount that can be charged, regardless of the
                number of units consumed.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )
        }}
      />
    </>
  )
}

export interface ProductPriceItemProps {
  organization: schemas['Organization']
  index: number
}

export const ProductPriceItem: React.FC<ProductPriceItemProps> = ({
  organization,
  index,
}) => {
  const { register, control, setValue, watch } =
    useFormContext<ProductFormType>()
  const amountType = watch(`prices.${index}.amount_type`)

  const { isFeatureEnabled } = usePostHog()

  const prices = watch('prices')
  const staticPriceIndex = prices
    ? (prices as schemas['ProductPrice'][]).findIndex(isStaticPrice)
    : -1

  const onAmountTypeChange = useCallback(
    (amountType: schemas['ProductCreate']['prices'][number]['amount_type']) => {
      const replace = (v: schemas['ProductCreate']['prices'][number]) => {
        setValue(`prices.${index}`, v)
      }
      if (amountType === 'fixed') {
        replace({
          amount_type: 'fixed',
          price_currency: 'usd',
          price_amount: 0,
        })
      } else if (amountType === 'custom') {
        replace({
          amount_type: 'custom',
          price_currency: 'usd',
        })
      } else if (amountType === 'free') {
        replace({
          amount_type: 'free',
        })
      } else if (amountType === 'metered_unit') {
        replace({
          amount_type: 'metered_unit',
          price_currency: 'usd',
          unit_amount: 0,
          meter_id: '',
        })
      }
    },
    [index, setValue],
  )

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" {...register(`prices.${index}.id`)} />
      <FormField
        control={control}
        name={`prices.${index}.amount_type`}
        render={({ field }) => {
          return (
            <FormItem>
              <FormControl>
                <Select
                  value={field.value}
                  onValueChange={(v) => {
                    field.onChange(v)
                    onAmountTypeChange(v as any)
                    setValue(`prices.${index}.id`, '')
                  }}
                  disabled={staticPriceIndex > -1 && staticPriceIndex !== index}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a price type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed price</SelectItem>
                    <SelectItem value="custom">Pay what you want</SelectItem>
                    <SelectItem value="free">Free</SelectItem>
                    {isFeatureEnabled('usage_based_billing') && (
                      <SelectItem value="metered_unit">
                        Metered price
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )
        }}
      />
      {amountType === 'fixed' && <ProductPriceFixedItem index={index} />}
      {amountType === 'custom' && <ProductPriceCustomItem index={index} />}
      {amountType === 'free' && <ProductPriceFreeItem index={index} />}
      {amountType === 'metered_unit' && (
        <ProductPriceMeteredUnitItem
          organization={organization}
          index={index}
        />
      )}
    </div>
  )
}

export interface ProductPricingSectionProps {
  organization: schemas['Organization']
  className?: string
  update?: boolean
  compact?: boolean
}

export const ProductPricingSection = ({
  organization,
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
  const { fields: prices, replace, append } = pricesFieldArray

  const isLegacyRecurringProduct = useMemo(
    () => (prices as schemas['ProductPrice'][]).some(isLegacyRecurringPrice),
    [prices],
  )
  const [legacyMigration, setLegacyMigration] = useState(false)

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
  }, [prices, replace, setValue])

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
          {prices.map((price, index) => (
            <div key={price.id} className="rounded-xl border p-4">
              <ProductPriceItem organization={organization} index={index} />
            </div>
          ))}
          <Button
            onClick={() =>
              append({
                amount_type: 'metered_unit',
                price_currency: 'usd',
                meter_id: '',
                unit_amount: 0,
              })
            }
          >
            Add price
          </Button>
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
