'use client'

import { type schemas } from '@polar-sh/client'
import { Alert, Input } from '@polar-sh/orbit'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import MoneyInput from '@polar-sh/ui/components/atoms/MoneyInput'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import React, { useCallback, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { getUnitLabels } from '@/utils/product'
import { ProductFormType } from '../ProductForm'
import { UnitLabelFields } from './UnitLabelFields'
import { UnitTierEditor } from './UnitTierEditor'

type TieringModel = 'fixed' | 'graduated' | 'volume'

export interface ProductPriceUnitBasedItemProps {
  index: number
  currency: string
}

export const ProductPriceUnitBasedItem: React.FC<
  ProductPriceUnitBasedItemProps
> = ({ index, currency }) => {
  const { control, setValue, watch, getValues } =
    useFormContext<ProductFormType>()

  const currentTierType = watch(`prices.${index}.tiers.type`)
  const minimumUnits = watch(`prices.${index}.minimum_units`)
  const unitLabel = watch(`prices.${index}.unit_label`)
  const { unitLabel: singularNoun, unitLabelPlural: pluralNoun } =
    getUnitLabels({ unit_label: unitLabel ?? null })

  const deriveTieringModel = (): TieringModel => {
    if (currentTierType === 'graduated') {
      return 'graduated'
    }
    const currentTiers = getValues(`prices.${index}.tiers.tiers`)
    if (!currentTiers || currentTiers.length <= 1) {
      return 'fixed'
    }
    return 'volume'
  }

  const [tieringModel, setTieringModel] =
    useState<TieringModel>(deriveTieringModel)

  const handleTieringModelChange = useCallback(
    (value: TieringModel) => {
      setTieringModel(value)
      setValue(`prices.${index}.id`, '')

      if (value === 'fixed') {
        setValue(`prices.${index}.tiers.type`, 'volume' as schemas['TierType'])
        const currentTiers = getValues(`prices.${index}.tiers.tiers`)
        setValue(`prices.${index}.tiers.tiers`, [
          {
            bound: null,
            unit_amount: Number(currentTiers?.[0]?.unit_amount) || 0,
          },
        ])
      } else {
        setValue(`prices.${index}.tiers.type`, value as schemas['TierType'])
      }
    },
    [getValues, setValue, index],
  )

  return (
    <Box flexDirection="column" rowGap="xl">
      <UnitLabelFields index={index} />

      <FormItem>
        <FormLabel>Tiering model</FormLabel>
        <Box display="block">
          <Select
            value={tieringModel}
            onValueChange={(v) => handleTieringModelChange(v as TieringModel)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fixed">
                Fixed price per {singularNoun}
              </SelectItem>
              <SelectItem value="volume">Volume</SelectItem>
              <SelectItem value="graduated">Graduated</SelectItem>
            </SelectContent>
          </Select>
        </Box>
      </FormItem>

      <FormField
        control={control}
        name={`prices.${index}.tiers.type` as const}
        render={({ field }) => (
          <input type="hidden" name={field.name} value={field.value ?? ''} />
        )}
      />

      {tieringModel === 'fixed' ? (
        <FormField
          control={control}
          name={`prices.${index}.tiers.tiers.0.unit_amount` as const}
          rules={{
            required: 'This field is required',
            min: {
              value: 0,
              message: 'Price must be greater than or equal to 0',
            },
          }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Price per {singularNoun}</FormLabel>
              <FormControl>
                <Box ref={field.ref} tabIndex={-1} display="block">
                  <MoneyInput
                    name={field.name}
                    currency={currency}
                    value={
                      field.value == null || field.value === ''
                        ? null
                        : Number(field.value)
                    }
                    onChange={(v) => {
                      field.onChange(v)
                      setValue(`prices.${index}.id`, '')
                    }}
                    placeholder={1000}
                  />
                </Box>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      ) : (
        <UnitTierEditor index={index} currency={currency} />
      )}

      <FormField
        control={control}
        name={`prices.${index}.minimum_units` as const}
        rules={{
          min: { value: 1, message: 'Must be at least 1' },
        }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Minimum {pluralNoun}</FormLabel>
            <FormControl>
              <Input
                {...field}
                type="number"
                min={1}
                step={1}
                value={field.value ?? ''}
                placeholder="1"
                onChange={(e) => {
                  const parsed = Number.parseInt(e.target.value, 10)
                  field.onChange(Number.isNaN(parsed) ? null : parsed)
                  setValue(`prices.${index}.id`, '')
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {typeof minimumUnits === 'number' && minimumUnits > 1 && (
        <Alert
          variant="info"
          title={
            minimumUnits === 2
              ? `Buying one ${singularNoun} is not allowed`
              : `Buying less than ${minimumUnits} ${pluralNoun} is not allowed`
          }
        />
      )}
    </Box>
  )
}
