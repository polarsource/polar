'use client'

import { Section } from '@/components/Layout/Section'
import { Input, Text } from '@polar-sh/orbit'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { useFormContext } from 'react-hook-form'
import { ProductFormType } from './ProductForm'

export interface ProductInfoSectionProps {
  className?: string
  compact?: boolean
  nameFlagged?: boolean
}

export const ProductInfoSection = ({
  className,
  compact,
  nameFlagged,
}: ProductInfoSectionProps) => {
  const { control } = useFormContext<ProductFormType>()

  return (
    <Section
      title="Product"
      description="Basic product information"
      className={className}
      compact={compact}
    >
      <div className="flex w-full flex-col gap-y-6">
        <FormField
          control={control}
          name="name"
          rules={{
            required: 'This field is required',
            minLength: {
              value: 3,
              message: 'Name must be at least 3 characters',
            },
            maxLength: {
              value: 64,
              message: 'Name must be at most 64 characters',
            },
          }}
          defaultValue=""
          render={({ field }) => (
            <FormItem>
              <div className="flex flex-row items-center justify-between">
                <FormLabel>Name</FormLabel>
              </div>
              <FormControl>
                <Input {...field} value={field.value || ''} />
              </FormControl>
              <FormMessage />
              {nameFlagged && (
                <Text variant="caption" color="warning">
                  This name suggests a product that is not permitted under our{' '}
                  <a
                    href="https://polar.sh/legal/acceptable-use-policy"
                    className="underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Acceptable Use Policy
                  </a>
                  .
                </Text>
              )}
            </FormItem>
          )}
        />
      </div>
    </Section>
  )
}
