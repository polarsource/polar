/* eslint-disable max-lines */
'use client'

import { type schemas } from '@polar-sh/client'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import MoneyInput from '@polar-sh/ui/components/atoms/MoneyInput'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { Label } from '@polar-sh/ui/components/ui/label'
import {
  RadioGroup,
  RadioGroupItem,
} from '@polar-sh/ui/components/ui/radio-group'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/ui/components/ui/tooltip'
import { InfoIcon } from 'lucide-react'
import React, { useCallback } from 'react'
import { useFieldArray, useFormContext } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import { ProductFormType } from '../ProductForm'

export interface ProductPriceSeatBasedItemProps {
  index: number
  currency: string
}

export const ProductPriceSeatBasedItem: React.FC<
  ProductPriceSeatBasedItemProps
> = ({ index, currency }) => {
  const { control, setValue, watch, getValues } =
    useFormContext<ProductFormType>()
  const { fields, append, remove } = useFieldArray({
    control,
    name: `prices.${index}.seat_tiers.tiers` as const,
  })

  const tiers = watch(`prices.${index}.seat_tiers.tiers`)

  const syncMaxSeats = useCallback(() => {
    const currentTiers = getValues(`prices.${index}.seat_tiers.tiers`)
    if (!currentTiers || currentTiers.length === 0) return

    if (currentTiers.length === 1) {
      setValue(`prices.${index}.seat_tiers.tiers.0.max_seats`, null)
      return
    }

    for (let i = 0; i < currentTiers.length; i++) {
      const expectedMax =
        i === currentTiers.length - 1
          ? null
          : (currentTiers[i + 1]?.min_seats ?? 1) - 1
      setValue(`prices.${index}.seat_tiers.tiers.${i}.max_seats`, expectedMax)
    }
  }, [getValues, setValue, index])

  const addTier = useCallback(() => {
    const lastTier = tiers?.[tiers.length - 1]
    const newMinSeats = lastTier?.max_seats
      ? lastTier.max_seats + 1
      : (lastTier?.min_seats ?? 1) + 10

    if (tiers && tiers.length > 0) {
      setValue(
        `prices.${index}.seat_tiers.tiers.${tiers.length - 1}.max_seats`,
        newMinSeats - 1,
      )
    }

    append({
      min_seats: newMinSeats,
      max_seats: null,
      price_per_seat: lastTier?.price_per_seat ?? 0,
    })
    setValue(`prices.${index}.id`, '')
  }, [tiers, append, setValue, index])

  const removeTier = useCallback(
    (tierIndex: number) => {
      remove(tierIndex)
      setValue(`prices.${index}.id`, '')
      syncMaxSeats()
    },
    [remove, setValue, index, syncMaxSeats],
  )

  const hasSingleTier = fields.length === 1

  const getTierTitle = (
    tierIndex: number,
    tier: { min_seats?: number; max_seats?: number | null } | undefined,
  ) => {
    if (!tier) return `${tierIndex + 1} seats`

    const plural = tier.min_seats !== 1
    const range = !tier.max_seats
      ? `${tier.min_seats} or more seat${plural ? 's' : ''}`
      : tier.max_seats === tier.min_seats
        ? `${tier.min_seats} seat${plural ? 's' : ''}`
        : `between ${tier.min_seats} and ${tier.max_seats} seats`

    return `Buying ${range}`
  }

  const pricingType =
    watch(`prices.${index}.seat_tiers.seat_tier_type`) ?? 'volume'

  const pricingTypeLabel =
    pricingType === 'graduated'
      ? 'Add tier'
      : hasSingleTier
        ? 'Add volume discount'
        : 'Add volume discount threshold'

  return (
    <div className="flex flex-col gap-6">
      <FormField
        control={control}
        name={`prices.${index}.seat_tiers.seat_tier_type` as const}
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              <span className="flex items-center gap-x-1.5">
                Pricing model
                <Tooltip>
                  <TooltipTrigger asChild>
                    <InfoIcon className="dark:text-polar-400 h-3.5 w-3.5 text-gray-400" />
                  </TooltipTrigger>
                  <TooltipContent className="flex max-w-xs flex-col gap-2 text-xs">
                    <p>
                      Example: Tier 1 is 1-10 seats at $10, Tier 2 is 11+ at $8.
                    </p>
                    <div>
                      <p className="font-medium">Volume</p>
                      <p>5 seats = 5 × $10 = $50</p>
                      <p>15 seats = 15 × $8 = $120</p>
                      <p className="dark:text-polar-400 text-gray-400">
                        All seats use the single matching tier.
                      </p>
                    </div>
                    <div>
                      <p className="font-medium">Graduated</p>
                      <p>5 seats = 5 × $10 = $50</p>
                      <p>15 seats = 10 × $10 + 5 × $8 = $140</p>
                      <p className="dark:text-polar-400 text-gray-400">
                        Each tier range is priced independently.
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </span>
            </FormLabel>
            <FormControl>
              <RadioGroup
                value={field.value ?? 'volume'}
                onValueChange={(v) => {
                  field.onChange(v as schemas['SeatTierType'])
                  setValue(`prices.${index}.id`, '')
                }}
                className="grid grid-cols-2 gap-3"
              >
                {(
                  [
                    {
                      value: 'volume',
                      label: 'Volume',
                      description: 'All seats priced at the matching tier rate',
                    },
                    {
                      value: 'graduated',
                      label: 'Graduated',
                      description: 'Each tier range priced independently',
                    },
                  ] as const
                ).map((option) => (
                  <Label
                    key={option.value}
                    htmlFor={`pricing-type-${index}-${option.value}`}
                    className={`flex cursor-pointer flex-col gap-1 rounded-2xl border p-4 font-normal transition-colors ${
                      (field.value ?? 'volume') === option.value
                        ? 'dark:bg-polar-800 bg-gray-50'
                        : 'dark:border-polar-700 dark:hover:border-polar-700 dark:text-polar-500 dark:hover:bg-polar-700 dark:bg-polar-900 border-gray-100 text-gray-500 hover:border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 font-medium">
                      <RadioGroupItem
                        value={option.value}
                        id={`pricing-type-${index}-${option.value}`}
                      />
                      {option.label}
                    </div>
                    <span className="dark:text-polar-500 text-xs text-gray-400">
                      {option.description}
                    </span>
                  </Label>
                ))}
              </RadioGroup>
            </FormControl>
          </FormItem>
        )}
      />

      {!hasSingleTier &&
        tiers?.[0]?.min_seats != null &&
        tiers[0].min_seats > 1 && (
          <div className="dark:border-polar-800 dark:bg-polar-900 rounded-2xl border border-gray-200 bg-white p-4 opacity-50">
            <span className="dark:text-polar-500 text-sm text-gray-500">
              {tiers[0].min_seats === 2
                ? 'Buying one seat is not allowed'
                : `Buying less than ${tiers[0].min_seats} seats is not allowed`}
            </span>
          </div>
        )}
      {fields.map((field, tierIndex) => {
        const isFirst = tierIndex === 0
        const currentTier = tiers?.[tierIndex]

        return (
          <div
            key={field.id}
            className={twMerge(
              'group relative',
              hasSingleTier
                ? ''
                : 'dark:bg-polar-900 dark:border-polar-800 rounded-2xl border border-gray-200 bg-white p-4',
            )}
            role="group"
            aria-labelledby={`tier-title-${index}-${tierIndex}`}
          >
            {!hasSingleTier && (
              <div className="mb-3 flex items-center justify-between">
                <span
                  id={`tier-title-${index}-${tierIndex}`}
                  className="dark:text-polar-500 text-sm font-medium text-gray-500"
                >
                  {getTierTitle(tierIndex, currentTier)}
                </span>
                {!isFirst && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="dark:text-polar-500 h-7 w-7 text-gray-500"
                    onClick={() => removeTier(tierIndex)}
                    aria-label={`Remove ${getTierTitle(tierIndex, currentTier)}`}
                  >
                    <CloseOutlined className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={control}
                name={
                  `prices.${index}.seat_tiers.tiers.${tierIndex}.min_seats` as const
                }
                rules={{
                  required: 'Required',
                  min: { value: 1, message: 'Must be at least 1' },
                  validate: (value) => {
                    if (isFirst || value == null) return true
                    const prevTier = tiers?.[tierIndex - 1]
                    if (
                      prevTier &&
                      prevTier.min_seats &&
                      value <= prevTier.min_seats
                    ) {
                      return `Must be greater than ${prevTier.min_seats}`
                    }
                    return true
                  },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {hasSingleTier ? 'Minimum Seats' : 'Starting from'}
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        min={
                          tierIndex > 0
                            ? (tiers?.[tierIndex - 1]?.min_seats ?? 1) + 1
                            : 1
                        }
                        onChange={(e) => {
                          const parsed = parseInt(e.target.value)
                          field.onChange(isNaN(parsed) ? '' : parsed)
                          setValue(`prices.${index}.id`, '')
                          syncMaxSeats()
                        }}
                        onBlur={(e) => {
                          field.onBlur()
                          const minAllowed =
                            tierIndex > 0
                              ? (tiers?.[tierIndex - 1]?.min_seats ?? 1) + 1
                              : 1
                          const parsed = parseInt(e.target.value)
                          const clamped = Math.max(
                            isNaN(parsed) ? minAllowed : parsed,
                            minAllowed,
                          )
                          field.onChange(clamped)
                          syncMaxSeats()
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
                render={({ field }) => (
                  <input
                    type="hidden"
                    name={field.name}
                    value={field.value ?? ''}
                    ref={field.ref}
                  />
                )}
              />

              <FormField
                control={control}
                name={
                  `prices.${index}.seat_tiers.tiers.${tierIndex}.price_per_seat` as const
                }
                rules={{
                  required: 'This field is required',
                  min: {
                    value: 0,
                    message: 'Price must be greater than or equal to 0',
                  },
                }}
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Price per seat</FormLabel>
                    <FormControl>
                      <div ref={field.ref} tabIndex={-1}>
                        <MoneyInput
                          name={field.name}
                          currency={currency}
                          value={field.value}
                          onChange={(v) => {
                            field.onChange(v)
                            setValue(`prices.${index}.id`, '')
                          }}
                          placeholder={1000}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        )
      })}

      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={addTier}
        className="self-start"
      >
        {pricingTypeLabel}
      </Button>
    </div>
  )
}
