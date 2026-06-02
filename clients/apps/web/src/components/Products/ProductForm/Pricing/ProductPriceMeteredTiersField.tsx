'use client'

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
import React, { useCallback } from 'react'
import { useFieldArray, useFormContext } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import { ProductFormType } from '../ProductForm'
import UnitAmountInput from '../UnitAmountInput'

export interface ProductPriceMeteredTiersFieldProps {
  index: number
  currency: string
  tierType: 'volume' | 'graduated'
}

export const ProductPriceMeteredTiersField: React.FC<
  ProductPriceMeteredTiersFieldProps
> = ({ index, currency, tierType }) => {
  const { control, setValue, watch, getValues } =
    useFormContext<ProductFormType>()
  const { fields, append, remove } = useFieldArray({
    control,
    name: `prices.${index}.metered_tiers.tiers` as const,
  })

  const tiers = watch(`prices.${index}.metered_tiers.tiers`)

  const syncMaxUnits = useCallback(() => {
    const currentTiers = getValues(`prices.${index}.metered_tiers.tiers`)
    if (!currentTiers || currentTiers.length === 0) return

    for (let i = 0; i < currentTiers.length; i++) {
      const expectedMax =
        i === currentTiers.length - 1
          ? null
          : (currentTiers[i + 1]?.min_units ?? 1) - 1
      setValue(
        `prices.${index}.metered_tiers.tiers.${i}.max_units`,
        expectedMax,
      )
    }
  }, [getValues, setValue, index])

  const addTier = useCallback(() => {
    const lastTier = tiers?.[tiers.length - 1]
    const newMinUnits = lastTier?.max_units
      ? lastTier.max_units + 1
      : (lastTier?.min_units ?? 1) + 10

    if (tiers && tiers.length > 0) {
      setValue(
        `prices.${index}.metered_tiers.tiers.${tiers.length - 1}.max_units`,
        newMinUnits - 1,
      )
    }

    append({
      min_units: newMinUnits,
      max_units: null,
      unit_amount: lastTier?.unit_amount ?? 0,
      flat_amount: null,
    })
    setValue(`prices.${index}.id`, '')
  }, [tiers, append, setValue, index])

  const removeTier = useCallback(
    (tierIndex: number) => {
      remove(tierIndex)
      setValue(`prices.${index}.id`, '')
      syncMaxUnits()
    },
    [remove, setValue, index, syncMaxUnits],
  )

  const getTierTitle = (
    tierIndex: number,
    tier: { min_units?: number; max_units?: number | null } | undefined,
  ) => {
    if (!tier) return `Tier ${tierIndex + 1}`

    if (tierType === 'volume') {
      const range = !tier.max_units
        ? `${tier.min_units} or more units`
        : tier.max_units === tier.min_units
          ? `${tier.min_units} units`
          : `${tier.min_units} to ${tier.max_units} units`
      return `Consuming ${range}`
    }

    if (!tier.max_units) return `Units ${tier.min_units}+`
    if (tier.max_units === tier.min_units) return `Unit ${tier.min_units}`
    return `Units ${tier.min_units}–${tier.max_units}`
  }

  return (
    <div className="flex flex-col gap-6">
      {fields.map((field, tierIndex) => {
        const isFirst = tierIndex === 0
        const currentTier = tiers?.[tierIndex]

        return (
          <div
            key={field.id}
            className="dark:bg-polar-900 dark:border-polar-700 group relative rounded-2xl border border-gray-200 bg-white p-4"
            role="group"
            aria-labelledby={`metered-tier-title-${index}-${tierIndex}`}
          >
            <div className="mb-3 flex items-center justify-between">
              <span
                id={`metered-tier-title-${index}-${tierIndex}`}
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

            <div className="grid grid-cols-2 gap-4">
              {!isFirst && (
                <FormField
                  control={control}
                  name={
                    `prices.${index}.metered_tiers.tiers.${tierIndex}.min_units` as const
                  }
                  rules={{
                    required: 'Required',
                    min: { value: 1, message: 'Must be at least 1' },
                    validate: (value) => {
                      if (value == null) return true
                      const prevTier = tiers?.[tierIndex - 1]
                      if (
                        prevTier &&
                        prevTier.min_units &&
                        value <= prevTier.min_units
                      ) {
                        return `Must be greater than ${prevTier.min_units}`
                      }
                      return true
                    },
                  }}
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Starting from (units)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          min={(tiers?.[tierIndex - 1]?.min_units ?? 1) + 1}
                          onChange={(e) => {
                            const parsed = parseInt(e.target.value)
                            field.onChange(isNaN(parsed) ? '' : parsed)
                            setValue(`prices.${index}.id`, '')
                            syncMaxUnits()
                          }}
                          onBlur={(e) => {
                            field.onBlur()
                            const minAllowed =
                              (tiers?.[tierIndex - 1]?.min_units ?? 1) + 1
                            const parsed = parseInt(e.target.value)
                            const clamped = Math.max(
                              isNaN(parsed) ? minAllowed : parsed,
                              minAllowed,
                            )
                            field.onChange(clamped)
                            syncMaxUnits()
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
                  `prices.${index}.metered_tiers.tiers.${tierIndex}.max_units` as const
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
                  `prices.${index}.metered_tiers.tiers.${tierIndex}.unit_amount` as const
                }
                rules={{
                  required: 'This field is required',
                  min: {
                    value: 0,
                    message: 'Must be greater than or equal to 0',
                  },
                }}
                render={({ field }) => (
                  <FormItem
                    className={twMerge(isFirst ? 'col-span-1' : 'col-span-1')}
                  >
                    <FormLabel>Amount per unit</FormLabel>
                    <FormControl>
                      <UnitAmountInput
                        name={field.name}
                        currency={currency}
                        value={field.value ?? undefined}
                        onValueChange={(v) => {
                          field.onChange(v)
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
                  `prices.${index}.metered_tiers.tiers.${tierIndex}.flat_amount` as const
                }
                render={({ field }) => (
                  <FormItem className="col-span-1">
                    <FormLabel>Flat fee (optional)</FormLabel>
                    <FormControl>
                      <MoneyInput
                        name={field.name}
                        currency={currency}
                        value={field.value ?? undefined}
                        onChange={(v) => {
                          field.onChange(v)
                          setValue(`prices.${index}.id`, '')
                        }}
                        placeholder={0}
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

      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={addTier}
        className="self-start"
      >
        Add tier
      </Button>
    </div>
  )
}
