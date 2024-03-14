'use client'

import { ErrorMessage } from '@hookform/error-message'
import { ClearOutlined } from '@mui/icons-material'
import {
  SubscriptionTierCreate,
  SubscriptionTierPriceCreate,
  SubscriptionTierPriceRecurringInterval,
  SubscriptionTierType,
  SubscriptionTierUpdate,
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
import React, { useMemo } from 'react'
import {
  UseFieldArrayReturn,
  useFieldArray,
  useFormContext,
} from 'react-hook-form'
import SubscriptionGroupIcon from './SubscriptionGroupIcon'

interface SubscriptionTierPriceItemProps {
  index: number
  fieldArray: UseFieldArrayReturn<
    SubscriptionTierCreate | SubscriptionTierUpdate,
    'prices',
    'id'
  >
}

const SubscriptionTierPriceItem: React.FC<SubscriptionTierPriceItemProps> = ({
  index,
  fieldArray,
}) => {
  const { control, register, watch, setValue } = useFormContext<
    SubscriptionTierCreate | SubscriptionTierUpdate
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
      <FormField
        control={control}
        name={`prices.${index}.price_amount`}
        rules={{ required: 'This field is required', min: 0 }}
        render={({ field }) => {
          return (
            <FormItem className="max-w-[300px] grow">
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
                          SubscriptionTierPriceRecurringInterval.MONTH && (
                          <span>/mo</span>
                        )}
                        {recurringInterval ===
                          SubscriptionTierPriceRecurringInterval.YEAR && (
                          <span>/year</span>
                        )}
                      </>
                    }
                  />
                </FormControl>
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
              </div>
              <FormMessage />
            </FormItem>
          )
        }}
      />
    </div>
  )
}

interface SubscriptionTierFormProps {
  update?: boolean
  isFreeTier?: boolean
}

const SubscriptionTierForm: React.FC<SubscriptionTierFormProps> = ({
  update,
  isFreeTier,
}) => {
  const {
    control,
    formState: { errors },
  } = useFormContext<SubscriptionTierCreate | SubscriptionTierUpdate>()

  const pricesFieldArray = useFieldArray({
    control,
    name: 'prices',
    rules: {
      minLength: 1,
    },
  })
  const { fields: prices, append } = pricesFieldArray

  const hasMonthlyPrice = useMemo(
    () =>
      (prices as SubscriptionTierPriceCreate[]).some(
        (price: SubscriptionTierPriceCreate) =>
          price.recurring_interval ===
          SubscriptionTierPriceRecurringInterval.MONTH,
      ),
    [prices],
  )
  const hasYearlyPrice = useMemo(
    () =>
      (prices as SubscriptionTierPriceCreate[]).some(
        (price) =>
          price.recurring_interval ===
          SubscriptionTierPriceRecurringInterval.YEAR,
      ),
    [prices],
  )

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
          <FormItem className="max-w-[300px]">
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
      {!update && (
        <FormField
          control={control}
          name="type"
          rules={{ required: 'This field is required' }}
          render={({ field }) => (
            <FormItem className="max-w-[300px]">
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
      {!isFreeTier && (
        <>
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
                    Highlighted tiers are shown on the public overview page.
                    <br />
                    Only one tier can be highlighted per tier type.
                  </p>
                </div>
              )
            }}
          />
          <div className="flex flex-col gap-2">
            <FormLabel>Pricing</FormLabel>
            {prices.map((price, index) => (
              <SubscriptionTierPriceItem
                key={price.id}
                index={index}
                fieldArray={pricesFieldArray}
              />
            ))}
            <div className="flex flex-row gap-2">
              {!hasMonthlyPrice && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="self-start"
                  type="button"
                  onClick={() =>
                    append({
                      id: '',
                      recurring_interval:
                        SubscriptionTierPriceRecurringInterval.MONTH,
                      price_currency: 'usd',
                      price_amount: 0,
                    })
                  }
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
                  onClick={() =>
                    append({
                      id: '',
                      recurring_interval:
                        SubscriptionTierPriceRecurringInterval.YEAR,
                      price_currency: 'usd',
                      price_amount: 0,
                    })
                  }
                >
                  Add yearly pricing
                </Button>
              )}
            </div>
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
      <FormField
        control={control}
        name="description"
        rules={{
          maxLength: 240,
        }}
        render={({ field }) => (
          <FormItem>
            <div className="flex flex-row items-center justify-between">
              <FormLabel>Description</FormLabel>
              <span className="dark:text-polar-400 text-sm text-gray-400">
                {field.value?.length ?? 0} / 240
              </span>
            </div>
            <FormControl>
              <TextArea {...field} resizable={false} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  )
}

export default SubscriptionTierForm
