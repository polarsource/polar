'use client'

import { Section } from '@/components/Layout/Section'
import Input from '@polar-sh/ui/components/atoms/Input'
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
}

export const ProductInfoSection = ({
  className,
  compact,
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
            minLength: 3,
            maxLength: 64,
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
            </FormItem>
          )}
        />
      </div>
    </Section>
  )
}
