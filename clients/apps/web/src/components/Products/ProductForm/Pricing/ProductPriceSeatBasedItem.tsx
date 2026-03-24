'use client'

import { type schemas } from '@polar-sh/client'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import { Button } from '@polar-sh/orbit'
import Input from '@polar-sh/ui/components/atoms/Input'
import MoneyInput from '@polar-sh/ui/components/atoms/MoneyInput'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import React, { useCallback, useState } from 'react'
import { useFieldArray, useFormContext } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import { ProductFormType } from '../ProductForm'
import Alert from '@polar-sh/ui/components/atoms/Alert'

type TieringModel = 'fixed' | 'graduated' | 'volume'

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
  const currentPricingType = watch(`prices.${index}.seat_tiers.seat_tier_type`)

  const deriveTieringModel = (): TieringModel => {
    if (currentPricingType === 'graduated') return 'graduated'
    const currentTiers = getValues(`prices.${index}.seat_tiers.tiers`)
    if (
      currentPricingType === 'volume' &&
      (!currentTiers || currentTiers.length <= 1)
    )
      return 'fixed'
    return 'volume'
  }

  const [tieringModel, setTieringModel] =
    useState<TieringModel>(deriveTieringModel)

  const handleTieringModelChange = useCallback(
    (value: TieringModel) => {
      setTieringModel(value)
      setValue(`prices.${index}.id`, '')

      if (value === 'fixed') {
        setValue(
          `prices.${index}.seat_tiers.seat_tier_type`,
          'volume' as schemas['SeatTierType'],
        )
        const currentTiers = getValues(`prices.${index}.seat_tiers.tiers`)
        const firstTier = currentTiers?.[0]
        setValue(`prices.${index}.seat_tiers.tiers`, [
          {
            min_seats: 1,
            max_seats: null,
            price_per_seat: firstTier?.price_per_seat ?? 0,
          },
        ])
      } else if (value === 'graduated') {
        setValue(
          `prices.${index}.seat_tiers.seat_tier_type`,
          'graduated' as schemas['SeatTierType'],
        )
      } else {
        setValue(
          `prices.${index}.seat_tiers.seat_tier_type`,
          'volume' as schemas['SeatTierType'],
        )
      }
    },
    [getValues, setValue, index],
  )

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
    if (!tier) return `Tier ${tierIndex + 1}`

    if (tieringModel === 'volume') {
      const plural = tier.min_seats !== 1
      const range = !tier.max_seats
        ? `${tier.min_seats} or more seat${plural ? 's' : ''}`
        : tier.max_seats === tier.min_seats
          ? `${tier.min_seats} seat${plural ? 's' : ''}`
          : `between ${tier.min_seats} and ${tier.max_seats} seats`
      return `Buying ${range}`
    }

    if (!tier.max_seats) return `Seats ${tier.min_seats}+`
    if (tier.max_seats === tier.min_seats) return `Seat ${tier.min_seats}`
    return `Seats ${tier.min_seats}–${tier.max_seats}`
  }

  const addTierLabel =
    tieringModel === 'graduated'
      ? 'Add tier'
      : hasSingleTier
        ? 'Add discount'
        : 'Add discount threshold'

  return (
    <div className="flex flex-col gap-6">
      <FormItem>
        <FormLabel>
          <span className="flex items-center gap-x-1.5">Tiering model</span>
        </FormLabel>
        <Select
          value={tieringModel}
          onValueChange={(v) => handleTieringModelChange(v as TieringModel)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fixed">Fixed price per seat</SelectItem>
            <SelectItem value="graduated">Graduated</SelectItem>
            <SelectItem value="volume">Volume discounts</SelectItem>
          </SelectContent>
        </Select>
      </FormItem>

      {/* Hidden field to keep seat_tier_type in sync */}
      <FormField
        control={control}
        name={`prices.${index}.seat_tiers.seat_tier_type` as const}
        render={({ field }) => (
          <input type="hidden" name={field.name} value={field.value ?? ''} />
        )}
      />

      {!hasSingleTier &&
        tiers?.[0]?.min_seats != null &&
        tiers[0].min_seats > 1 && (
          <Alert color="gray" className="p-3 px-4 text-sm">
            {tiers[0].min_seats === 2
              ? 'Buying one seat is not allowed'
              : `Buying less than ${tiers[0].min_seats} seats is not allowed`}
          </Alert>
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
                : 'dark:bg-polar-900 dark:border-polar-700 rounded-2xl border border-gray-200 bg-white p-4',
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
              {tieringModel !== 'fixed' && (
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
                      <FormLabel>Tier Threshold</FormLabel>
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
              )}

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
                  <FormItem
                    className={
                      tieringModel === 'fixed' ? 'col-span-3' : 'col-span-2'
                    }
                  >
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

      {tieringModel !== 'fixed' && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={addTier}
          className="self-start"
        >
          {addTierLabel}
        </Button>
      )}
    </div>
  )
}
