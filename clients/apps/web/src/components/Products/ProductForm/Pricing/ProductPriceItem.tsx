'use client'

import { isStaticPrice } from '@/utils/product'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
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
import { hasPriceCurrency, ProductPrice, ProductPriceCreate } from './utils'

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
}

export const ProductPriceItem: React.FC<ProductPriceItemProps> = ({
  organization,
  index,
  currency,
  onRemove,
  onAmountTypeChange,
  canRemove,
}) => {
  const { register, control, watch } = useFormContext<ProductFormType>()
  const amountType = watch(`prices.${index}.amount_type`)
  const recurringInterval = watch('recurring_interval')

  const prices = watch('prices')
  const pricesForCurrency = (prices || []).filter(
    (p) => hasPriceCurrency(p) && p.price_currency === currency,
  )
  const staticPriceForCurrency = pricesForCurrency.find((p) =>
    isStaticPrice(p as ProductPrice),
  )
  const currentPrice = prices?.[index]
  const isCurrentPriceStatic =
    currentPrice && isStaticPrice(currentPrice as ProductPrice)
  const hasOtherStaticPrice = staticPriceForCurrency && !isCurrentPriceStatic

  return (
    <div className="flex flex-col gap-y-6">
      <input type="hidden" {...register(`prices.${index}.id`)} />
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
                    disabled={hasOtherStaticPrice}
                  >
                    <SelectTrigger ref={field.ref}>
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
                {canRemove && (
                  <Button
                    size="icon"
                    className="aspect-square h-10 w-10"
                    variant="secondary"
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
      {amountType && amountType !== 'free' && (
        <div className="flex flex-col gap-3">
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
