'use client'

import { Input } from '@polar-sh/orbit'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import React from 'react'
import { useFormContext } from 'react-hook-form'
import { ProductFormType } from '../ProductForm'

export interface UnitMaximumFieldProps {
  index: number
  unitLabelPlural: string
}

export const UnitMaximumField: React.FC<UnitMaximumFieldProps> = ({
  index,
  unitLabelPlural,
}) => {
  const { control, setValue, watch } = useFormContext<ProductFormType>()

  const tiers = watch(`prices.${index}.tiers.tiers`)
  const minimumUnits = watch(`prices.${index}.minimum_units`)
  const lastTier = Math.max((tiers?.length ?? 1) - 1, 0)
  const previousBound = Number(tiers?.[lastTier - 1]?.bound ?? 0)

  return (
    <FormField
      control={control}
      name={`prices.${index}.tiers.tiers.${lastTier}.bound` as const}
      rules={{
        validate: (value) => {
          if (value == null) {
            return true
          }
          if (!Number.isInteger(Number(value))) {
            return 'Must be a whole number of units'
          }
          if (Number(value) <= previousBound) {
            return `Must be greater than ${previousBound}`
          }
          if (minimumUnits != null && Number(value) < Number(minimumUnits)) {
            return `Must be at least the minimum of ${minimumUnits}`
          }
          return true
        },
      }}
      render={({ field }) => (
        <FormItem>
          <FormLabel>Maximum {unitLabelPlural}</FormLabel>
          <FormControl>
            <Input
              {...field}
              type="number"
              min={Math.max(previousBound + 1, Number(minimumUnits) || 1)}
              step={1}
              value={field.value ?? ''}
              placeholder="Unlimited"
              onChange={(e) => {
                const raw = e.target.value
                if (raw === '') {
                  field.onChange(null)
                } else {
                  const parsed = Number(raw)
                  field.onChange(Number.isNaN(parsed) ? null : parsed)
                }
                setValue(`prices.${index}.id`, '')
              }}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
