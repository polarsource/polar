'use client'

import { Section } from '@/components/Layout/Section'
import Input from '@polar-sh/ui/components/atoms/Input'
import TextArea from '@polar-sh/ui/components/atoms/TextArea'
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
      title="Product Information"
      description="Basic product information which helps identify the product"
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
        <FormField
          control={control}
          name="description"
          render={({ field }) => (
            <FormItem className="flex flex-col gap-2">
              <div className="flex flex-row items-center justify-between">
                <FormLabel>Description</FormLabel>
                <p className="dark:text-polar-500 text-sm text-gray-500">
                  Markdown format
                </p>
              </div>
              <FormControl>
                <TextArea
                  className="min-h-44 resize-none rounded-2xl font-mono text-xs!"
                  {...field}
                  value={field.value || ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </Section>
  )
}
