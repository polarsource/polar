'use client'

import CloseOutlined from '@mui/icons-material/CloseOutlined'
import { schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/orbit'
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import React from 'react'
import { useFormContext } from 'react-hook-form'
import { ProductFormType } from '../ProductForm'
import { ProductPriceCustomItem } from './ProductPriceCustomItem'
import { ProductPriceFixedItem } from './ProductPriceFixedItem'
import { ProductPriceMeteredUnitItem } from './ProductPriceMeteredUnitItem'
import { ProductPriceSeatBasedItem } from './ProductPriceSeatBasedItem'
import { ProductPriceCreate } from './utils'

const AMOUNT_TYPE_LABELS: Record<string, string> = {
  fixed: 'Fixed price',
  custom: 'Pay what you want',
  seat_based: 'Seats',
  metered_unit: 'Metered price',
}

interface ProductPriceItemProps {
  organization: schemas['Organization']
  index: number
  currency: string
  onRemove: (index: number) => void
  onAmountTypeChange: (
    index: number,
    amountType: ProductPriceCreate['amount_type'],
  ) => void
  canRemove: boolean
  canChangeType?: boolean
}

export const ProductPriceItem: React.FC<ProductPriceItemProps> = ({
  organization,
  index,
  currency,
  onRemove,
  onAmountTypeChange,
  canRemove,
  canChangeType = true,
}) => {
  const { register, control, watch } = useFormContext<ProductFormType>()
  const amountType = watch(`prices.${index}.amount_type`)
  const recurringInterval = watch('recurring_interval')

  return (
    <div className="flex flex-col gap-y-6">
      <input type="hidden" {...register(`prices.${index}.id`)} />
      {!canChangeType ? (
        <div className="flex flex-row items-center justify-between">
          <h4 className="text-sm font-medium">
            {amountType ? AMOUNT_TYPE_LABELS[amountType] : 'Price'}
          </h4>
          {canRemove && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                onRemove(index)
              }}
            >
              Remove
            </Button>
          )}
        </div>
      ) : (
        <FormField
          control={control}
          name={`prices.${index}.amount_type`}
          rules={{
            required: 'Please select a price type',
          }}
          render={({ field }) => {
            return (
              <FormItem>
                <div className="flex flex-row items-center gap-2">
                  <FormControl>
                    <Select
                      value={field.value}
                      onValueChange={(v) => {
                        field.onChange(v)
                        onAmountTypeChange(
                          index,
                          v as ProductPriceCreate['amount_type'],
                        )
                      }}
                    >
                      <SelectTrigger ref={field.ref}>
                        <SelectValue placeholder="Select a price type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">
                          {AMOUNT_TYPE_LABELS.fixed}
                        </SelectItem>
                        <SelectItem value="custom">
                          {AMOUNT_TYPE_LABELS.custom}
                        </SelectItem>
                        {organization.feature_settings
                          ?.seat_based_pricing_enabled && (
                          <SelectItem value="seat_based">
                            {AMOUNT_TYPE_LABELS.seat_based}
                          </SelectItem>
                        )}
                        {recurringInterval !== null && (
                          <SelectItem value="metered_unit">
                            {AMOUNT_TYPE_LABELS.metered_unit}
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  {canRemove && (
                    <Button
                      size="icon"
                      className="aspect-square h-10 w-10"
                      variant="ghost"
                      onClick={() => {
                        onRemove(index)
                      }}
                    >
                      <CloseOutlined className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <FormMessage className="px-3 py-2" />
              </FormItem>
            )
          }}
        />
      )}
      {amountType && (
        <div className="flex flex-col gap-4">
          {amountType === 'fixed' && (
            <ProductPriceFixedItem index={index} currency={currency} />
          )}
          {amountType === 'custom' && (
            <ProductPriceCustomItem index={index} currency={currency} />
          )}
          {amountType === 'seat_based' && (
            <ProductPriceSeatBasedItem index={index} currency={currency} />
          )}
          {amountType === 'metered_unit' && (
            <ProductPriceMeteredUnitItem
              organization={organization}
              index={index}
              currency={currency}
            />
          )}
        </div>
      )}
    </div>
  )
}
