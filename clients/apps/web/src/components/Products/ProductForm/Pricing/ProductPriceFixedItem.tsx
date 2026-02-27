'use client'

import MoneyInput from '@polar-sh/ui/components/atoms/MoneyInput'
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import React from 'react'
import { useFormContext } from 'react-hook-form'
import { ProductFormType } from '../ProductForm'

export interface ProductPriceFixedItemProps {
  index: number
  currency: string
}

export const ProductPriceFixedItem: React.FC<ProductPriceFixedItemProps> = ({
  index,
  currency,
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
                  <div ref={field.ref} className="flex-1" tabIndex={-1}>
                    <MoneyInput
                      name={field.name}
                      currency={currency}
                      value={field.value}
                      onChange={(v) => {
                        field.onChange(v)
                        setValue(`prices.${index}.id`, '')
                      }}
                      placeholder={0}
                    />
                  </div>
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
