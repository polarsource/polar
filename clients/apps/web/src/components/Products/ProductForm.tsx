'use client'

import { ErrorMessage } from '@hookform/error-message'
import { ClearOutlined } from '@mui/icons-material'
import {
  Organization,
  ProductCreate,
  ProductMediaFileRead,
  ProductPrice,
  ProductPriceType,
  ProductUpdate,
  SubscriptionRecurringInterval,
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
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import { Tabs, TabsList, TabsTrigger } from 'polarkit/components/ui/atoms/tabs'
import TextArea from 'polarkit/components/ui/atoms/textarea'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from 'polarkit/components/ui/form'
import React, { useEffect, useMemo, useState } from 'react'
import {
  UseFieldArrayReturn,
  useFieldArray,
  useFormContext,
} from 'react-hook-form'
import ProductMediasField from './ProductMediasField'

export interface ProductFullMediasMixin {
  full_medias: ProductMediaFileRead[]
}

export type ProductFormType = (ProductCreate | ProductUpdate) &
  ProductFullMediasMixin

interface ProductPriceItemProps {
  index: number
  fieldArray: UseFieldArrayReturn<ProductFormType, 'prices', 'id'>
  deletable: boolean
}

const ProductPriceItem: React.FC<ProductPriceItemProps> = ({
  index,
  fieldArray,
  deletable,
}) => {
  const { control, register, watch, setValue } =
    useFormContext<ProductFormType>()
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
      <input type="hidden" {...register(`prices.${index}.amount_type`)} />
      <FormField
        control={control}
        name={`prices.${index}.price_amount`}
        rules={{
          required: 'This field is required',
          min: { value: 1, message: 'Price must be greater than 0' },
        }}
        render={({ field }) => {
          return (
            <FormItem className="grow">
              <div className="flex gap-2">
                <FormControl>
                  <MoneyInput
                    name={field.name}
                    value={field.value}
                    onChange={(v) => {
                      field.onChange(v)
                      setValue(`prices.${index}.id`, '')
                    }}
                    placeholder={0}
                    postSlot={
                      <>
                        {recurringInterval ===
                          SubscriptionRecurringInterval.MONTH && (
                          <span className="text-sm">/month</span>
                        )}
                        {recurringInterval ===
                          SubscriptionRecurringInterval.YEAR && (
                          <span className="text-sm">/year</span>
                        )}
                      </>
                    }
                  />
                </FormControl>
                {deletable && (
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

interface ProductPriceCustomItemProps {
  index: number
}

const ProductPriceCustomItem: React.FC<ProductPriceCustomItemProps> = ({
  index,
}) => {
  const { control, register, setValue } = useFormContext<ProductFormType>()

  return (
    <div className="flex items-center gap-2">
      <input
        type="hidden"
        {...register(`prices.${index}.recurring_interval`)}
      />
      <input type="hidden" {...register(`prices.${index}.id`)} />
      <input type="hidden" {...register(`prices.${index}.type`)} />
      <input type="hidden" {...register(`prices.${index}.amount_type`)} />
      <FormField
        control={control}
        name={`prices.${index}.minimum_amount`}
        rules={{
          min: { value: 50, message: 'Price must be greater than 0.5' },
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
          min: { value: 50, message: 'Price must be greater than 0.5' },
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

interface ProductPriceFreeItemProps {
  index: number
}

const ProductPriceFreeItem: React.FC<ProductPriceFreeItemProps> = ({
  index,
}) => {
  const { register } = useFormContext<ProductFormType>()

  return (
    <>
      <input
        type="hidden"
        {...register(`prices.${index}.recurring_interval`)}
      />
      <input type="hidden" {...register(`prices.${index}.id`)} />
      <input type="hidden" {...register(`prices.${index}.type`)} />
      <input type="hidden" {...register(`prices.${index}.amount_type`)} />
    </>
  )
}

interface ProductFormProps {
  organization: Organization
  update?: boolean
}

const ProductForm: React.FC<ProductFormProps> = ({ organization, update }) => {
  const {
    control,
    formState: { errors },
    clearErrors,
  } = useFormContext<ProductFormType>()

  const pricesFieldArray = useFieldArray({
    control,
    name: 'prices',
  })
  const { fields: prices, append, replace } = pricesFieldArray

  const hasMonthlyPrice = useMemo(
    () =>
      (prices as ProductPrice[]).some(
        (price) =>
          price.type === 'recurring' &&
          price.recurring_interval === SubscriptionRecurringInterval.MONTH,
      ),
    [prices],
  )
  const hasYearlyPrice = useMemo(
    () =>
      (prices as ProductPrice[]).some(
        (price) =>
          price.type === 'recurring' &&
          price.recurring_interval === SubscriptionRecurringInterval.YEAR,
      ),
    [prices],
  )

  const [pricingType, setPricingType] = useState<ProductPriceType | undefined>(
    hasMonthlyPrice || hasYearlyPrice
      ? ProductPriceType.RECURRING
      : ProductPriceType.ONE_TIME,
  )

  const [amountType, setAmountType] = useState<'fixed' | 'custom' | 'free'>(
    prices.length > 0 && (prices as ProductPrice[])[0].amount_type
      ? (prices as ProductPrice[])[0].amount_type
      : 'fixed',
  )

  useEffect(() => {
    if (update) return

    if (pricingType === ProductPriceType.ONE_TIME) {
      if (amountType === 'fixed') {
        replace([
          {
            type: 'one_time',
            amount_type: 'fixed',
            price_currency: 'usd',
            price_amount: 0,
          },
        ])
      } else if (amountType === 'custom') {
        replace([
          {
            type: 'one_time',
            amount_type: 'custom',
            price_currency: 'usd',
          },
        ])
      } else {
        replace([
          {
            type: 'one_time',
            amount_type: 'free',
          },
        ])
      }
    } else if (pricingType === ProductPriceType.RECURRING) {
      if (amountType === 'fixed') {
        replace([
          {
            type: 'recurring',
            amount_type: 'fixed',
            recurring_interval: SubscriptionRecurringInterval.MONTH,
            price_currency: 'usd',
            price_amount: 0,
          },
        ])
      } else if (amountType === 'free') {
        replace([
          {
            type: 'recurring',
            amount_type: 'free',
            recurring_interval: SubscriptionRecurringInterval.MONTH,
          },
        ])
      } else {
        setAmountType('fixed')
      }
    }
  }, [update, pricingType, replace, amountType])

  return (
    <>
      <ShadowBox className="flex flex-col gap-y-6">
        <FormField
          control={control}
          name="name"
          rules={{
            required: 'This field is required',
            minLength: 3,
          }}
          defaultValue=""
          render={({ field }) => (
            <FormItem>
              <div className="flex flex-row items-center justify-between">
                <FormLabel>Name</FormLabel>
              </div>
              <FormControl>
                <Input {...field} value={field.value || ''} />
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
                <p className="dark:text-polar-500 text-sm text-gray-500">
                  Markdown format
                </p>
              </div>
              <FormControl>
                <TextArea
                  className="min-h-44 resize-none rounded-2xl"
                  {...field}
                  value={field.value || ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </ShadowBox>
      <ShadowBox>
        <div className="flex flex-col gap-6">
          <FormLabel>Pricing</FormLabel>
          {!update && (
            <Tabs
              value={pricingType}
              onValueChange={(value: string) =>
                setPricingType(value as ProductPriceType)
              }
            >
              <TabsList className="dark:bg-polar-950 w-full rounded-full bg-gray-100">
                <TabsTrigger
                  className="flex-grow"
                  value={ProductPriceType.ONE_TIME}
                  size="small"
                >
                  Pay Once
                </TabsTrigger>
                <TabsTrigger
                  className="flex-grow"
                  value={ProductPriceType.RECURRING}
                  size="small"
                >
                  Subscription
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}
          {!update && (
            <Select
              value={amountType}
              onValueChange={(value) =>
                setAmountType(value as 'fixed' | 'custom' | 'free')
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a product" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">Fixed price</SelectItem>
                {pricingType === ProductPriceType.ONE_TIME && (
                  <SelectItem value="custom">Pay what you want</SelectItem>
                )}
                <SelectItem value="free">Free</SelectItem>
              </SelectContent>
            </Select>
          )}
          {prices.map((price, index) => (
            <>
              {amountType === 'fixed' && (
                <ProductPriceItem
                  key={price.id}
                  index={index}
                  fieldArray={pricesFieldArray}
                  deletable={pricingType === ProductPriceType.RECURRING}
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
          {amountType !== 'free' &&
            pricingType === ProductPriceType.RECURRING && (
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
                        amount_type: 'fixed',
                        recurring_interval: SubscriptionRecurringInterval.MONTH,
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
                        amount_type: 'fixed',
                        recurring_interval: SubscriptionRecurringInterval.YEAR,
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
              <p className="text-destructive text-sm font-medium">{message}</p>
            )}
          />
        </div>
      </ShadowBox>

      <ShadowBox>
        <FormField
          control={control}
          name="full_medias"
          render={({ field }) => (
            <FormItem className="flex flex-col gap-2">
              <div className="flex flex-row items-center justify-between">
                <FormLabel>Media</FormLabel>
              </div>
              <FormControl>
                <ProductMediasField
                  organization={organization}
                  value={field.value}
                  onChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </ShadowBox>
    </>
  )
}

export default ProductForm
