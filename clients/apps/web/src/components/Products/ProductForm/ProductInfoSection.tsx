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
import { Label } from '@polar-sh/ui/components/ui/label'
import {
  RadioGroup,
  RadioGroupItem,
} from '@polar-sh/ui/components/ui/radio-group'
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
        <FormField
          control={control}
          name="visibility"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Visibility</FormLabel>
              <FormControl>
                <div className="@container">
                  <RadioGroup
                    value={field.value ?? 'public'}
                    onValueChange={field.onChange}
                    className="grid-cols-1 gap-3 @md:grid-cols-2"
                  >
                    <Label
                      htmlFor="visibility-public"
                      className={`flex cursor-pointer flex-col gap-2 rounded-2xl border p-4 font-normal transition-colors ${
                        field.value === 'public' || !field.value
                          ? 'dark:bg-polar-800 bg-gray-50'
                          : 'dark:border-polar-700 dark:hover:border-polar-700 dark:text-polar-500 dark:hover:bg-polar-700 dark:bg-polar-900 border-gray-100 text-gray-500 hover:border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 font-medium">
                        <RadioGroupItem value="public" id="visibility-public" />
                        Public
                      </div>
                      <p className="dark:text-polar-500 text-sm text-gray-500">
                        Shown in the Customer Portal
                      </p>
                    </Label>
                    <Label
                      htmlFor="visibility-private"
                      className={`flex cursor-pointer flex-col gap-2 rounded-2xl border p-4 font-normal transition-colors ${
                        field.value === 'private'
                          ? 'dark:bg-polar-800 bg-gray-50'
                          : 'dark:border-polar-700 dark:hover:border-polar-700 dark:text-polar-500 dark:hover:bg-polar-700 dark:bg-polar-900 border-gray-100 text-gray-500 hover:border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 font-medium">
                        <RadioGroupItem
                          value="private"
                          id="visibility-private"
                        />
                        Private
                      </div>
                      <p className="dark:text-polar-500 text-sm text-gray-500">
                        Only purchasable via a direct checkout link
                      </p>
                    </Label>
                  </RadioGroup>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </Section>
  )
}
