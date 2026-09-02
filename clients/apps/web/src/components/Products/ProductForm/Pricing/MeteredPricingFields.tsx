'use client'

import { useMeters } from '@/hooks/queries/meters'
import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import { formatCurrency } from '@polar-sh/currency'
import MoneyInput from '@polar-sh/ui/components/atoms/MoneyInput'
import { getMeterUnitFormat } from '@polar-sh/ui/lib/meterUnit'
import {
  FormControl,
  FormDescription,
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/orbit'
import { InfoIcon } from 'lucide-react'
import React, { useCallback, useMemo } from 'react'
import { useFormContext } from 'react-hook-form'
import { ProductFormType } from '../ProductForm'
import UnitAmountInput from '../UnitAmountInput'
import { MeteredTierEditor } from './MeteredTierEditor'

type MeteredPricingModel = 'fixed' | 'graduated' | 'volume'

export interface MeteredPricingFieldsProps {
  organization: schemas['Organization']
  index: number
  currency: string
}

export const MeteredPricingFields: React.FC<MeteredPricingFieldsProps> = ({
  organization,
  index,
  currency,
}) => {
  const { control, setValue, watch, getValues } =
    useFormContext<ProductFormType>()

  const { data: meters } = useMeters(organization.id, {
    sorting: ['name'],
    limit: 30,
    is_archived: false,
  })

  const meterId = watch(`prices.${index}.meter_id`)
  const amountType = watch(`prices.${index}.amount_type`)
  const unitAmount = watch(`prices.${index}.unit_amount`)
  const tiersValue = watch(`prices.${index}.tiers`)
  const tieredPricingEnabled =
    organization.feature_settings?.metered_tiered_pricing_enabled ?? false

  const pricingModel: MeteredPricingModel =
    tieredPricingEnabled && amountType === 'metered_tiers' && tiersValue
      ? tiersValue.type
      : 'fixed'

  // A flat rate and tiers are separate price types, so switching the model
  // replaces the price rather than clearing one of its fields.
  const handlePricingModelChange = useCallback(
    (value: MeteredPricingModel) => {
      const base = {
        price_currency: getValues(`prices.${index}.price_currency`),
        meter_id: getValues(`prices.${index}.meter_id`),
        cap_amount: getValues(`prices.${index}.cap_amount`),
        tax_behavior: getValues(`prices.${index}.tax_behavior`),
      }
      const currentTiers = getValues(`prices.${index}.tiers`)
      if (value === 'fixed') {
        setValue(`prices.${index}`, {
          ...base,
          amount_type: 'metered_unit',
          unit_amount: Number(currentTiers?.tiers?.[0]?.unit_amount) || 0,
        })
      } else {
        setValue(`prices.${index}`, {
          ...base,
          amount_type: 'metered_tiers',
          tiers: {
            type: value,
            tiers: currentTiers?.tiers ?? [
              {
                bound: null,
                unit_amount: getValues(`prices.${index}.unit_amount`) ?? 0,
              },
            ],
          },
        })
      }
      setValue(`prices.${index}.id`, '')
    },
    [getValues, setValue, index],
  )

  const pricePreview = useMemo(() => {
    const selectedMeter = meters?.items.find(
      (m: schemas['Meter']) => m.id === meterId,
    )
    const { scale, label } = getMeterUnitFormat(
      selectedMeter?.unit ?? 'scalar',
      {
        customLabel: selectedMeter?.custom_label,
        customMultiplier: selectedMeter?.custom_multiplier,
      },
    )
    const cents = Number.parseFloat(String(unitAmount || '0'))
    const formatted = formatCurrency('subcent')(cents * scale, currency)
    return `${formatted} / ${label}`
  }, [meterId, unitAmount, meters, currency])

  return (
    <>
      {tieredPricingEnabled ? (
        <FormItem>
          <FormLabel>Pricing model</FormLabel>
          <Box display="block">
            <Select
              value={pricingModel}
              onValueChange={(v) =>
                handlePricingModelChange(v as MeteredPricingModel)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">Flat price per unit</SelectItem>
                <SelectItem value="graduated">Graduated</SelectItem>
                <SelectItem value="volume">Volume</SelectItem>
              </SelectContent>
            </Select>
          </Box>
        </FormItem>
      ) : null}

      {pricingModel === 'fixed' ? (
        <FormField
          control={control}
          name={`prices.${index}.unit_amount`}
          rules={{
            required: 'This field is required',
            validate: (value) =>
              Number(value) > 0 || 'Amount must be greater than 0',
          }}
          render={({ field }) => {
            return (
              <FormItem>
                <FormLabel>Amount per unit</FormLabel>
                <FormControl>
                  <UnitAmountInput
                    {...field}
                    name={field.name}
                    currency={currency}
                    value={field.value ?? ''}
                    onValueChange={(v) => {
                      field.onChange(v)
                      setValue(`prices.${index}.id`, '')
                    }}
                  />
                </FormControl>
                <FormDescription>Displayed as {pricePreview}</FormDescription>
                <FormMessage />
              </FormItem>
            )
          }}
        />
      ) : (
        <MeteredTierEditor index={index} currency={currency} />
      )}

      <FormField
        control={control}
        name={`prices.${index}.cap_amount`}
        render={({ field }) => {
          return (
            <FormItem>
              <FormLabel>
                <Box
                  as="span"
                  display="inline-flex"
                  alignItems="center"
                  columnGap="xs"
                >
                  Cap amount
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Box
                        as="span"
                        display="inline-flex"
                        color="text-tertiary"
                      >
                        <InfoIcon className="h-3.5 w-3.5" />
                      </Box>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-3xs">
                      Optional maximum amount that can be charged, regardless of
                      the number of units consumed.
                    </TooltipContent>
                  </Tooltip>
                </Box>
              </FormLabel>
              <FormControl>
                <MoneyInput
                  {...field}
                  name={field.name}
                  currency={currency}
                  value={field.value}
                  onChange={(v) => {
                    field.onChange(v)
                    setValue(`prices.${index}.id`, '')
                  }}
                  placeholder={10000}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )
        }}
      />
    </>
  )
}
