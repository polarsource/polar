'use client'

import CreateMeterModalContent from '@/components/Meter/CreateMeterModalContent'
import MeterSelector from '@/components/Meter/MeterSelector'
import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import { SpinnerNoMargin } from '@/components/Shared/Spinner'
import { useMeters } from '@/hooks/queries/meters'
import { formatCurrency } from '@polar-sh/currency'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import MoneyInput from '@polar-sh/ui/components/atoms/MoneyInput'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/ui/components/ui/tooltip'
import { InfoIcon, PlusIcon } from 'lucide-react'
import React, { useCallback, useMemo } from 'react'
import { useFormContext } from 'react-hook-form'
import { ProductFormType } from '../ProductForm'
import UnitAmountInput from '../UnitAmountInput'
import { ProductPriceMeteredTiersField } from './ProductPriceMeteredTiersField'

type PricingModel = 'per_unit' | 'volume' | 'graduated'

export interface ProductPriceMeteredUnitItemProps {
  organization: schemas['Organization']
  index: number
  currency: string
}

export const ProductPriceMeteredUnitItem: React.FC<
  ProductPriceMeteredUnitItemProps
> = ({ organization, index, currency }) => {
  const { control, setValue, watch, getValues } =
    useFormContext<ProductFormType>()

  const { data: meters } = useMeters(organization.id, {
    sorting: ['name'],
    limit: 30,
    is_archived: false,
  })

  const meterId = watch(`prices.${index}.meter_id`)
  const unitAmount = watch(`prices.${index}.unit_amount`)
  const meteredTiers = watch(`prices.${index}.metered_tiers`)

  const pricingModel: PricingModel = meteredTiers
    ? meteredTiers.metered_tier_type === 'graduated'
      ? 'graduated'
      : 'volume'
    : 'per_unit'

  const handlePricingModelChange = useCallback(
    (value: PricingModel) => {
      setValue(`prices.${index}.id`, '')

      if (value === 'per_unit') {
        const currentTiers = getValues(`prices.${index}.metered_tiers.tiers`)
        const firstTier = currentTiers?.[0]
        setValue(`prices.${index}.metered_tiers`, null)
        setValue(`prices.${index}.unit_amount`, firstTier?.unit_amount ?? 0)
        return
      }

      const tierType = value as schemas['MeteredTierType']
      const existingTiers = getValues(`prices.${index}.metered_tiers.tiers`)
      if (existingTiers && existingTiers.length > 0) {
        setValue(`prices.${index}.metered_tiers.metered_tier_type`, tierType)
      } else {
        setValue(`prices.${index}.metered_tiers`, {
          metered_tier_type: tierType,
          tiers: [
            {
              min_units: 1,
              max_units: null,
              unit_amount: getValues(`prices.${index}.unit_amount`) ?? 0,
              flat_amount: null,
            },
          ],
        })
      }
      // The single unit_amount is derived from the first tier server-side.
      setValue(`prices.${index}.unit_amount`, null)
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
    const scaled = cents * scale
    const formatted = formatCurrency('subcent')(scaled, currency)
    return `${formatted} / ${label}`
  }, [meterId, unitAmount, meters, currency])

  const {
    isShown: isCreateMeterModalShown,
    show: showCreateMeterModal,
    hide: hideCreateMeterModal,
  } = useModal(false)

  const onSelectMeter = useCallback(
    (meter: schemas['Meter']) => {
      setValue(`prices.${index}.meter_id`, meter.id)
      setValue(`prices.${index}.id`, '')
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
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault()
                        showCreateMeterModal()
                      }}
                    >
                      <PlusIcon className="mr-1 h-4 w-4" />
                      Create Meter
                    </Button>
                  </div>
                  <FormControl>
                    <MeterSelector
                      organizationId={organization.id}
                      value={field.value || null}
                      onChange={(meterId) => {
                        field.onChange(meterId ?? '')
                        setValue(`prices.${index}.id`, '')
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )
            }}
          />

          <FormItem>
            <FormLabel>Pricing model</FormLabel>
            <Select
              value={pricingModel}
              onValueChange={(v) => handlePricingModelChange(v as PricingModel)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="per_unit">Per unit</SelectItem>
                <SelectItem value="volume">Volume tiers</SelectItem>
                <SelectItem value="graduated">Graduated tiers</SelectItem>
              </SelectContent>
            </Select>
          </FormItem>

          {pricingModel === 'per_unit' ? (
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
                        name={field.name}
                        currency={currency}
                        value={field.value ?? undefined}
                        onValueChange={(v) => {
                          field.onChange(v)
                          setValue(`prices.${index}.id`, '')
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      Displayed as {pricePreview}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )
              }}
            />
          ) : (
            <ProductPriceMeteredTiersField
              index={index}
              currency={currency}
              tierType={pricingModel}
            />
          )}

          <FormField
            control={control}
            name={`prices.${index}.cap_amount`}
            render={({ field }) => {
              return (
                <FormItem>
                  <FormLabel>
                    <span className="flex items-center gap-x-1.5">
                      Cap amount
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <InfoIcon className="dark:text-polar-400 h-3.5 w-3.5 text-gray-400" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-3xs">
                          Optional maximum amount that can be charged,
                          regardless of the number of units consumed.
                        </TooltipContent>
                      </Tooltip>
                    </span>
                  </FormLabel>
                  <FormControl>
                    <MoneyInput
                      {...field}
                      name={field.name}
                      currency={currency}
                      value={field.value ?? undefined}
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
