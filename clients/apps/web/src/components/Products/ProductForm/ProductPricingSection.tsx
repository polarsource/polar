'use client'

import CreateMeterModalContent from '@/components/Meter/CreateMeterModalContent'
import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import { SpinnerNoMargin } from '@/components/Shared/Spinner'
import { useMeters } from '@/hooks/queries/meters'
import {
  isLegacyRecurringPrice,
  isMeteredPrice,
  isStaticPrice,
} from '@/utils/product'
import { ErrorMessage } from '@hookform/error-message'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import MoneyInput from '@polar-sh/ui/components/atoms/MoneyInput'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { PlusIcon } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  useFieldArray,
  UseFieldArrayRemove,
  useFormContext,
} from 'react-hook-form'
import { Section } from '../../Layout/Section'
import { ProductFormType } from './ProductForm'
import UnitAmountInput from './UnitAmountInput'

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
    <div className="mt-1.5 flex flex-row gap-4 gap-x-6">
      <FormField
        control={control}
        name={`prices.${index}.minimum_amount`}
        rules={{
          min: { value: 50, message: 'Price must be greater than $0.5' },
        }}
        render={({ field }) => {
          return (
            <FormItem className="flex flex-1 flex-col gap-0.5">
              <FormLabel>Minimum amount</FormLabel>
              <FormControl>
                <MoneyInput
                  name={field.name}
                  value={field.value}
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
            <FormItem className="flex flex-1 flex-col gap-0.5">
              <FormLabel>Suggested amount</FormLabel>
              <FormControl>
                <MoneyInput
                  name={field.name}
                  value={field.value}
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

export interface ProductPriceSeatBasedItemProps {
  index: number
}

export const ProductPriceSeatBasedItem: React.FC<
  ProductPriceSeatBasedItemProps
> = ({ index }) => {
  const { control, setValue, watch } = useFormContext<ProductFormType>()
  const { fields, append, remove } = useFieldArray({
    control,
    name: `prices.${index}.seat_tiers.tiers` as const,
  })

  const tiers = watch(`prices.${index}.seat_tiers.tiers`)

  const DEFAULT_TIER_SIZE = 10

  const addTier = useCallback(() => {
    const lastTier = tiers?.[tiers.length - 1]
    const minSeats = lastTier?.max_seats ? lastTier.max_seats + 1 : 1

    // Update the current last tier to have a specific max_seats value
    if (tiers && tiers.length > 0) {
      const lastTierIndex = tiers.length - 1
      setValue(
        `prices.${index}.seat_tiers.tiers.${lastTierIndex}.max_seats`,
        minSeats - 1,
        { shouldValidate: true },
      )
    }

    // Add the new tier with max_seats: null (unlimited)
    // The LAST tier should ALWAYS have null max_seats
    append({
      min_seats: minSeats,
      max_seats: null,
      price_per_seat: 0,
    })
    setValue(`prices.${index}.id`, '')
  }, [tiers, append, setValue, index])

  const removeTier = useCallback(
    (tierIndex: number) => {
      remove(tierIndex)
      setValue(`prices.${index}.id`, '')

      // If only one tier remains after removal, set its max_seats to null (unlimited)
      if (tiers && tiers.length === 2) {
        // After removal there will be 1 tier left
        const remainingTierIndex = tierIndex === 0 ? 1 : 0
        setValue(
          `prices.${index}.seat_tiers.tiers.${remainingTierIndex}.max_seats`,
          null,
          { shouldValidate: true },
        )
      }
    },
    [remove, setValue, index, tiers],
  )

  const hasSingleTier = fields.length === 1

  const getTierTitle = (tierIndex: number, tier: any) => {
    if (!tier) return `Tier ${tierIndex + 1}`

    const isLast = tierIndex === fields.length - 1
    const range = isLast
      ? `${tier.min_seats}+ seats`
      : `${tier.min_seats}–${tier.max_seats || tier.min_seats} seats`

    return `Tier ${tierIndex + 1} (${range})`
  }

  return (
    <div className="flex flex-col gap-3">
      {fields.map((field, tierIndex) => {
        const isLast = tierIndex === fields.length - 1
        const isFirst = tierIndex === 0
        const currentTier = tiers?.[tierIndex]

        return (
          <div
            key={field.id}
            className="dark:bg-polar-900 group relative rounded-2xl border border-gray-200 bg-white dark:border-gray-800"
            role="group"
            aria-labelledby={`tier-title-${index}-${tierIndex}`}
          >
            <div className="flex items-center justify-between p-4">
              <span
                id={`tier-title-${index}-${tierIndex}`}
                className="text-sm font-medium text-gray-900 dark:text-white"
              >
                {getTierTitle(tierIndex, currentTier)}
              </span>
              {!isFirst && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="dark:text-polar-400 -mr-2 h-7 w-7 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-gray-600 dark:hover:text-gray-300"
                  onClick={() => removeTier(tierIndex)}
                  aria-label={`Remove ${getTierTitle(tierIndex, currentTier)}`}
                >
                  <CloseOutlined className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3 px-4 pb-4">
              <FormField
                control={control}
                name={
                  `prices.${index}.seat_tiers.tiers.${tierIndex}.min_seats` as const
                }
                rules={{
                  required: 'Required',
                  min: { value: 1, message: 'Must be at least 1' },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="dark:text-polar-500 text-xs text-gray-600">
                      From
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        min={1}
                        disabled={!isFirst}
                        onChange={(e) => {
                          field.onChange(parseInt(e.target.value) || 1)
                          setValue(`prices.${index}.id`, '')
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name={
                  `prices.${index}.seat_tiers.tiers.${tierIndex}.max_seats` as const
                }
                rules={{
                  validate: (value) => {
                    if (isLast) return true // Last tier is always unlimited (null)

                    const minSeats = tiers?.[tierIndex]?.min_seats

                    // max_seats must exist for non-last tiers
                    if (value === null || value === undefined) {
                      return 'Max seats is required'
                    }

                    // max_seats must be >= min_seats
                    if (minSeats && value < minSeats) {
                      return `Max seats must be at least ${minSeats}`
                    }

                    return true
                  },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="dark:text-polar-500 text-xs text-gray-600">
                      To
                    </FormLabel>
                    <FormControl>
                      {isLast ? (
                        <div className="dark:bg-polar-800 dark:text-polar-500 flex h-9 w-full items-center justify-center rounded-lg border border-gray-200 bg-gray-50 px-2.5 text-sm font-medium text-gray-500 dark:border-gray-800">
                          ∞
                        </div>
                      ) : (
                        <Input
                          {...field}
                          value={field.value ?? ''}
                          type="number"
                          min={tiers?.[tierIndex]?.min_seats ?? 1}
                          onChange={(e) => {
                            const value = e.target.value
                              ? parseInt(e.target.value)
                              : null
                            field.onChange(value)
                            setValue(`prices.${index}.id`, '')

                            // Update next tier's min_seats immediately
                            if (
                              value &&
                              tiers &&
                              tierIndex < tiers.length - 1
                            ) {
                              setValue(
                                `prices.${index}.seat_tiers.tiers.${tierIndex + 1}.min_seats`,
                                value + 1,
                                { shouldValidate: true },
                              )
                            }
                          }}
                        />
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name={
                  `prices.${index}.seat_tiers.tiers.${tierIndex}.price_per_seat` as const
                }
                rules={{
                  required: 'This field is required',
                  min: { value: 50, message: 'Price must be greater than 0.5' },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="dark:text-polar-500 text-xs text-gray-600">
                      Price per seat
                    </FormLabel>
                    <FormControl>
                      <MoneyInput
                        name={field.name}
                        value={field.value}
                        onChange={(v) => {
                          field.onChange(v)
                          setValue(`prices.${index}.id`, '')
                        }}
                        placeholder={1000}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        )
      })}

      <FormField
        control={control}
        name={`prices.${index}.seat_tiers.tiers` as const}
        render={() => (
          <FormItem>
            <FormMessage />
          </FormItem>
        )}
      />

      <Button
        type="button"
        variant="secondary"
        onClick={addTier}
        className="self-start"
      >
        {hasSingleTier ? 'Add Volume Tier' : 'Add Another Tier'}
      </Button>
    </div>
  )
}

export interface ProductPriceMeteredUnitItemProps {
  organization: schemas['Organization']
  index: number
}

export const ProductPriceMeteredUnitItem: React.FC<
  ProductPriceMeteredUnitItemProps
> = ({ organization, index }) => {
  const { control, setValue } = useFormContext<ProductFormType>()

  const { data: meters, refetch } = useMeters(organization.id, {
    sorting: ['name'],
    limit: 30,
    is_archived: false,
  })

  const {
    isShown: isCreateMeterModalShown,
    show: showCreateMeterModal,
    hide: hideCreateMeterModal,
  } = useModal(false)

  const onSelectMeter = useCallback(
    async (meter: schemas['Meter']) => {
      // This is embarrassing but the <Select /> component has to re-render
      // with the updated `meters` as options,
      // before it'll accept this as a valid select value.
      //
      // This is an open issue with Radix UI since 2024
      // (https://github.com/radix-ui/primitives/issues/2817)

      // To work around this, we run an explicit `refetch` that we can await
      // and then set the value in a double requestAnimationFrame callback.
      // First rAF ensures this component is updated,
      // second rAF ensures the <SelectContent /> was updated too.
      await refetch()

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          setValue(`prices.${index}.meter_id`, meter.id)
        })
      })
    },
    [setValue, index],
  )

  if (!meters) {
    return (
      <div className="flex w-full items-center justify-center py-4">
        <SpinnerNoMargin />
      </div>
    )
  }

  return (
    <>
      {meters.items.length === 0 ? (
        <Button
          onClick={(e) => {
            e.preventDefault()
            showCreateMeterModal()
          }}
          size="sm"
        >
          Create a Meter
        </Button>
      ) : (
        <>
          <FormField
            control={control}
            name={`prices.${index}.meter_id`}
            rules={{
              required: 'This field is required',
            }}
            render={({ field }) => {
              return (
                <FormItem>
                  <div className="flex flex-row items-center justify-between gap-x-2">
                    <FormLabel>Meter</FormLabel>
                    <button
                      type="button"
                      className="flex flex-row items-center gap-x-1 text-sm font-medium text-gray-500"
                      onClick={(e) => {
                        e.preventDefault()
                        showCreateMeterModal()
                      }}
                    >
                      <PlusIcon className="h-4 w-4" />
                      Add Meter
                    </button>
                  </div>
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
                    <UnitAmountInput
                      {...field}
                      name={field.name}
                      value={field.value}
                      onValueChange={(v) => {
                        field.onChange(v)
                        setValue(`prices.${index}.id`, '')
                      }}
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
                      value={field.value}
                      onChange={(v) => {
                        field.onChange(v)
                        setValue(`prices.${index}.id`, '')
                      }}
                      placeholder={10000}
                    />
                  </FormControl>
                  <FormDescription>
                    Optional maximum amount that can be charged, regardless of
                    the number of units consumed.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )
            }}
          />
        </>
      )}
      <InlineModal
        isShown={isCreateMeterModalShown}
        hide={hideCreateMeterModal}
        modalContent={
          <CreateMeterModalContent
            organization={organization}
            onSelectMeter={onSelectMeter}
            hideModal={hideCreateMeterModal}
          />
        }
      />
    </>
  )
}

const ProductPriceItemWrapper = ({
  prices,
  children,
}: {
  prices: schemas['ProductPrice'][]
  children: React.ReactNode
}) => {
  if (!prices || prices.length < 2) {
    return children
  }
  return (
    <div className="dark:border-polar-700 rounded-2xl border p-4">
      {children}
    </div>
  )
}

interface ProductPriceItemProps {
  organization: schemas['Organization']
  index: number
  remove: UseFieldArrayRemove
}

const ProductPriceItem: React.FC<ProductPriceItemProps> = ({
  organization,
  index,
  remove,
}) => {
  const { register, control, setValue, watch } =
    useFormContext<ProductFormType>()
  const amountType = watch(`prices.${index}.amount_type`)
  const recurringInterval = watch('recurring_interval')

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
      } else if (amountType === 'seat_based') {
        replace({
          amount_type: 'seat_based',
          price_currency: 'usd',
          seat_tiers: {
            tiers: [
              {
                min_seats: 1,
                max_seats: null,
                price_per_seat: 0,
              },
            ],
          },
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
              <div className="flex flex-row items-center gap-2">
                <FormControl>
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      field.onChange(v)
                      onAmountTypeChange(v as any)
                      setValue(`prices.${index}.id`, '')
                    }}
                    disabled={
                      staticPriceIndex > -1 && staticPriceIndex !== index
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a price type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Fixed price</SelectItem>
                      <SelectItem value="custom">Pay what you want</SelectItem>
                      <SelectItem value="free">Free</SelectItem>
                      {organization.feature_settings
                        ?.seat_based_pricing_enabled && (
                        <SelectItem value="seat_based">Seats</SelectItem>
                      )}
                      {recurringInterval !== null && (
                        <SelectItem value="metered_unit">
                          Metered price
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </FormControl>
                {index > 0 && (
                  <Button
                    size="icon"
                    className="aspect-square h-10 w-10"
                    variant="secondary"
                    onClick={() => {
                      remove(index)
                    }}
                  >
                    <CloseOutlined className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <FormMessage />
            </FormItem>
          )
        }}
      />
      {amountType === 'fixed' && <ProductPriceFixedItem index={index} />}
      {amountType === 'custom' && <ProductPriceCustomItem index={index} />}
      {amountType === 'free' && <ProductPriceFreeItem index={index} />}
      {amountType === 'seat_based' && (
        <ProductPriceSeatBasedItem index={index} />
      )}
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
    watch,
  } = useFormContext<ProductFormType>()

  const pricesFieldArray = useFieldArray({
    control,
    name: 'prices',
  })
  const { fields: prices, replace, append, remove } = pricesFieldArray

  const recurringInterval = watch('recurring_interval')
  const recurringIntervalCount = watch('recurring_interval_count')

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
        id: null,
        type: null,
        recurring_interval: null,
      } as any,
    ])
  }, [prices, replace, setValue])

  useEffect(() => {
    if (recurringInterval !== null) {
      if (!recurringIntervalCount) {
        setValue('recurring_interval_count', 1)
      }
      return
    }

    setValue('recurring_interval_count', null)
    prices.forEach((price, index) => {
      if (isMeteredPrice(price as schemas['ProductPrice'])) {
        remove(index)
      }
    })
  }, [
    recurringInterval,
    recurringIntervalCount,
    prices,
    remove,
    setValue,
    watch,
  ])

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
                        <SelectItem value="day">Daily</SelectItem>
                        <SelectItem value="week">Weekly</SelectItem>
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
          {recurringInterval !== null && (
            <FormField
              control={control}
              name="recurring_interval_count"
              rules={{
                required: 'This field is required when billing cycle is set',
                min: { value: 1, message: 'Interval count must be at least 1' },
                max: {
                  value: 999,
                  message: 'Interval count cannot exceed 999',
                },
              }}
              render={({ field }) => {
                return (
                  <FormItem className="flex flex-col gap-1">
                    <FormLabel>Billing Frequency</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-4">
                        <span className="text-gray-600">Every</span>
                        <Input
                          type="number"
                          min="1"
                          max="999"
                          value={field.value || 1}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 1
                            field.onChange(value)
                          }}
                          disabled={update && !legacyMigration}
                        />
                        <span className="text-gray-600">
                          {field.value === 1 || !field.value
                            ? recurringInterval
                            : `${recurringInterval}s`}
                        </span>
                      </div>
                    </FormControl>

                    <FormMessage />
                  </FormItem>
                )
              }}
            />
          )}

          {prices.map((price, index) => (
            <ProductPriceItemWrapper
              prices={prices as schemas['ProductPrice'][]}
              key={price.id}
            >
              <ProductPriceItem
                organization={organization}
                index={index}
                remove={remove}
              />
            </ProductPriceItemWrapper>
          ))}

          {update && recurringInterval && (
            <ShadowBox className="dark:bg-polar-800 flex flex-col gap-2 rounded-2xl! border-none! p-4">
              <h3 className="text-sm font-medium">Updating pricing model</h3>
              <p className="dark:text-polar-500 text-gray-5 00 text-sm">
                Changing pricing model on subscription products will only affect
                new customers. Current customers will keep their original
                pricing model.
              </p>
            </ShadowBox>
          )}
          {recurringInterval !== null && (
            <Button
              className="self-start"
              variant="secondary"
              onClick={() =>
                append({
                  amount_type: 'metered_unit',
                  price_currency: 'usd',
                  meter_id: '',
                  unit_amount: 0,
                })
              }
            >
              Add Additional Price
            </Button>
          )}
          <ErrorMessage
            errors={errors}
            name="prices"
            render={({ message }) => {
              // Don't render if message is undefined or invalid
              if (!message || message === 'undefined' || message === 'null') {
                return null
              }
              return (
                <p className="text-destructive text-sm font-medium">
                  {message}
                </p>
              )
            }}
          />
        </div>
      )}
    </Section>
  )
}
