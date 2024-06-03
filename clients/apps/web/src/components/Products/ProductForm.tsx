'use client'

import { isFeatureEnabled } from '@/utils/feature-flags'
import { ErrorMessage } from '@hookform/error-message'
import { ClearOutlined } from '@mui/icons-material'
import {
  PricesInner,
  ProductCreate,
  ProductPriceRecurringInterval,
  ProductPriceType,
  ProductUpdate,
  SubscriptionTierType,
} from '@polar-sh/sdk'
import Button from 'polarkit/components/ui/atoms/button'
import Input from 'polarkit/components/ui/atoms/input'
import MoneyInput from 'polarkit/components/ui/atoms/moneyinput'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'polarkit/components/ui/atoms/select'
import TextArea from 'polarkit/components/ui/atoms/textarea'
import { Checkbox } from 'polarkit/components/ui/checkbox'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from 'polarkit/components/ui/form'
import {
  ToggleGroup,
  ToggleGroupItem,
} from 'polarkit/components/ui/toggle-group'
import React, { useEffect, useMemo, useState } from 'react'
import {
  UseFieldArrayReturn,
  useFieldArray,
  useFormContext,
} from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import SubscriptionGroupIcon from '../Subscriptions/SubscriptionGroupIcon'
import ProductPriceTypeIcon from './ProductPriceTypeIcon'

interface ProductPriceItemProps {
  index: number
  fieldArray: UseFieldArrayReturn<ProductCreate | ProductUpdate, 'prices', 'id'>
  deletable: boolean
}

const ProductPriceItem: React.FC<ProductPriceItemProps> = ({
  index,
  fieldArray,
  deletable,
}) => {
  const { control, register, watch, setValue } = useFormContext<
    ProductCreate | ProductUpdate
  >()
  const { remove } = fieldArray
  const recurringInterval = watch(`prices.${index}.recurring_interval`)

  return (
    <div className="flex items-center gap-2">
      <input
        type="hidden"
        {...register(`prices.${index}.recurring_interval`)}
      />
      <input type="hidden" {...register(`prices.${index}.id`)} />
      <input type="hidden" {...register(`prices.${index}.type`)} />
      <FormField
        control={control}
        name={`prices.${index}.price_amount`}
        rules={{ required: 'This field is required', min: 0 }}
        render={({ field }) => {
          return (
            <FormItem className="grow">
              <div className="flex gap-2">
                <FormControl>
                  <MoneyInput
                    id="monthly-price"
                    name={field.name}
                    value={field.value}
                    onAmountChangeInCents={(v) => {
                      field.onChange(v)
                      setValue(`prices.${index}.id`, '')
                    }}
                    placeholder={0}
                    postSlot={
                      <>
                        {recurringInterval ===
                          ProductPriceRecurringInterval.MONTH && (
                          <span className="text-sm">/month</span>
                        )}
                        {recurringInterval ===
                          ProductPriceRecurringInterval.YEAR && (
                          <span className="text-sm">/year</span>
                        )}
                      </>
                    }
                  />
                </FormControl>
                {deletable && (
                  <button type="button">
                    <Button
                      className={
                        'border-none bg-transparent text-[16px] opacity-50 transition-opacity hover:opacity-100 dark:bg-transparent'
                      }
                      size="icon"
                      variant="secondary"
                      type="button"
                      onClick={() => remove(index)}
                    >
                      <ClearOutlined fontSize="inherit" />
                    </Button>
                  </button>
                )}
              </div>
              <FormMessage />
            </FormItem>
          )
        }}
      />
    </div>
  )
}

interface ProductFormProps {
  update?: boolean
  isFreeTier?: boolean
}

const ProductForm: React.FC<ProductFormProps> = ({ update, isFreeTier }) => {
  const {
    control,
    formState: { errors },
    clearErrors,
  } = useFormContext<ProductCreate | ProductUpdate>()

  const pricesFieldArray = useFieldArray({
    control,
    name: 'prices',
  })
  const { fields: prices, append, replace } = pricesFieldArray

  const hasMonthlyPrice = useMemo(
    () =>
      (prices as PricesInner[]).some(
        (price) =>
          price.type === 'recurring' &&
          price.recurring_interval === ProductPriceRecurringInterval.MONTH,
      ),
    [prices],
  )
  const hasYearlyPrice = useMemo(
    () =>
      (prices as PricesInner[]).some(
        (price) =>
          price.type === 'recurring' &&
          price.recurring_interval === ProductPriceRecurringInterval.YEAR,
      ),
    [prices],
  )

  const [pricingType, setPricingType] = useState<ProductPriceType | undefined>(
    hasMonthlyPrice || hasYearlyPrice
      ? ProductPriceType.RECURRING
      : ProductPriceType.ONE_TIME,
  )

  useEffect(() => {
    if (update) return

    if (pricingType === ProductPriceType.ONE_TIME) {
      replace([
        {
          type: 'one_time',
          price_currency: 'usd',
          price_amount: 0,
        },
      ])
    } else if (pricingType === ProductPriceType.RECURRING) {
      replace([
        {
          type: 'recurring',
          recurring_interval: ProductPriceRecurringInterval.MONTH,
          price_currency: 'usd',
          price_amount: 0,
        },
      ])
    }
  }, [update, pricingType, replace])

  const subscriptionTierTypes = useMemo(
    () =>
      ({
        [SubscriptionTierType.INDIVIDUAL]: 'Individual',
        [SubscriptionTierType.BUSINESS]: 'Business',
      }) as const,
    [],
  )

  return (
    <>
      <FormField
        control={control}
        name="name"
        rules={{
          required: 'This field is required',
          minLength: 3,
          maxLength: 24,
        }}
        defaultValue=""
        render={({ field }) => (
          <FormItem>
            <div className="flex flex-row items-center justify-between">
              <FormLabel>Name</FormLabel>
              <span className="dark:text-polar-400 text-sm text-gray-400">
                {field.value?.length ?? 0} / 24
              </span>
            </div>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="description"
        rules={{
          required: 'This field is required',
        }}
        render={({ field }) => (
          <FormItem className="flex flex-col gap-2">
            <div className="flex flex-row items-center justify-between">
              <FormLabel>Description</FormLabel>
            </div>
            <FormControl>
              <TextArea
                className="min-h-44 resize-none rounded-2xl"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      {!isFreeTier && (
        <>
          <div className="flex flex-col gap-4">
            <FormLabel>Pricing</FormLabel>
            {!update && isFeatureEnabled('products') && (
              <ToggleGroup
                className="gap-4"
                type="single"
                value={pricingType}
                onValueChange={(value: ProductPriceType) =>
                  setPricingType(value)
                }
              >
                <ToggleGroupItem
                  value={ProductPriceType.ONE_TIME}
                  className={twMerge(
                    'h-20 w-full flex-col items-start gap-2 rounded-xl border',
                    pricingType === ProductPriceType.ONE_TIME &&
                      'border-transparent',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <ProductPriceTypeIcon
                      productPriceType={ProductPriceType.ONE_TIME}
                    />
                    One-time purchase
                  </div>
                  <div className="font-normal">Charge a one-time fee</div>
                </ToggleGroupItem>
                <ToggleGroupItem
                  value={ProductPriceType.RECURRING}
                  className={twMerge(
                    'h-20 w-full flex-col items-start gap-2 rounded-xl border',
                    pricingType === ProductPriceType.RECURRING &&
                      'border-transparent',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <ProductPriceTypeIcon
                      productPriceType={ProductPriceType.RECURRING}
                    />
                    Subscription
                  </div>
                  <div className="font-normal">Charge an ongoing fee</div>
                </ToggleGroupItem>
              </ToggleGroup>
            )}
            {prices.map((price, index) => (
              <ProductPriceItem
                key={price.id}
                index={index}
                fieldArray={pricesFieldArray}
                deletable={pricingType === ProductPriceType.RECURRING}
              />
            ))}
            {pricingType === ProductPriceType.RECURRING && (
              <div className="flex flex-row gap-2">
                {!hasMonthlyPrice && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="self-start"
                    type="button"
                    onClick={() => {
                      append({
                        type: 'recurring',
                        recurring_interval: ProductPriceRecurringInterval.MONTH,
                        price_currency: 'usd',
                        price_amount: 0,
                      })
                      clearErrors('prices')
                    }}
                  >
                    Add monthly pricing
                  </Button>
                )}
                {!hasYearlyPrice && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="self-start"
                    type="button"
                    onClick={() => {
                      append({
                        type: 'recurring',
                        recurring_interval: ProductPriceRecurringInterval.YEAR,
                        price_currency: 'usd',
                        price_amount: 0,
                      })
                      clearErrors('prices')
                    }}
                  >
                    Add yearly pricing
                  </Button>
                )}
              </div>
            )}
            <ErrorMessage
              errors={errors}
              name="prices"
              render={({ message }) => (
                <p className="text-destructive text-sm font-medium">
                  {message}
                </p>
              )}
            />
          </div>
        </>
      )}
      {/* <FormField
        control={control}
        name="media"
        render={({ field }) => (
          <FormItem className="flex flex-col gap-2">
            <div className="flex flex-row items-center justify-between">
              <FormLabel>Media</FormLabel>
            </div>
            <FormControl>
              <ImageUpload
                width={1000}
                height={1000}
                onUploaded={field.onChange}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      /> */}
      {!update && pricingType === ProductPriceType.RECURRING && (
        <FormField
          control={control}
          name="type"
          rules={{ required: 'This field is required' }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a tier type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(subscriptionTierTypes).map(
                    ([type, pretty]) => (
                      <SelectItem key={type} value={type}>
                        <div className="flex items-center gap-2">
                          <SubscriptionGroupIcon
                            type={type as SubscriptionTierType}
                          />
                          {pretty}
                        </div>
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
      {!isFreeTier && pricingType === ProductPriceType.RECURRING && (
        <FormField
          control={control}
          name="is_highlighted"
          render={({ field }) => {
            return (
              <div className="flex flex-col gap-y-4">
                <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      defaultChecked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel className="text-sm leading-none">
                    Highlight this tier
                  </FormLabel>
                </FormItem>
                <p className="dark:text-polar-500 text-sm text-gray-500">
                  Highlighted tiers are shown on the public overview page. Only
                  one tier can be highlighted per tier type.
                </p>
              </div>
            )
          }}
        />
      )}
    </>
  )
}

export default ProductForm
