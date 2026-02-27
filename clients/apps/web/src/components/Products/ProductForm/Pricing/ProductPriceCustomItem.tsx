'use client'

import MoneyInput from '@polar-sh/ui/components/atoms/MoneyInput'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import React from 'react'
import { useFormContext } from 'react-hook-form'
import { ProductFormType } from '../ProductForm'

export interface ProductPriceCustomItemProps {
  index: number
  currency: string
}

export const ProductPriceCustomItem: React.FC<ProductPriceCustomItemProps> = ({
  index,
  currency,
}) => {
  const { control, setValue, getValues } = useFormContext<ProductFormType>()

  const validatePWYWAmount = (
    value: number | null | undefined,
  ): string | true => {
    if (value == null) {
      return 'This field is required'
    }

    if (value === 0 || value >= 50) {
      return true
    }

    return 'Must be 0 (for free) or at least 0.50'
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-row gap-4 gap-x-6">
        <FormField
          control={control}
          name={`prices.${index}.minimum_amount`}
          rules={{
            validate: validatePWYWAmount,
          }}
          render={({ field }) => {
            return (
              <FormItem className="flex flex-1 flex-col gap-0.5">
                <FormLabel>Minimum amount</FormLabel>
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
                <FormDescription className="text-muted-foreground text-xs">
                  Set to 0 to allow free contributions
                </FormDescription>
                <FormMessage />
              </FormItem>
            )
          }}
        />
        <FormField
          control={control}
          name={`prices.${index}.preset_amount`}
          rules={{
            deps: [`prices.${index}.minimum_amount`],
            validate: (value: number | null | undefined): string | true => {
              const pwywResult = validatePWYWAmount(value)

              if (pwywResult !== true) {
                return pwywResult
              }

              const minimumAmount = getValues(`prices.${index}.minimum_amount`)

              if (
                value != null &&
                minimumAmount != null &&
                value < minimumAmount
              ) {
                return 'Suggested amount cannot be less than minimum amount'
              }

              return true
            },
            max: {
              value: 1_000_000,
              message: 'Price cannot be greater than 10,000',
            },
          }}
          render={({ field }) => {
            return (
              <FormItem className="flex flex-1 flex-col gap-0.5">
                <FormLabel>Suggested amount</FormLabel>
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
                      placeholder={5000}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )
          }}
        />
      </div>
    </div>
  )
}
