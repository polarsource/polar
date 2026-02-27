'use client'

import { Section } from '@/components/Layout/Section'
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

export const ProductCustomerPortalSection = ({
  className,
}: {
  className?: string
}) => {
  const { control } = useFormContext<ProductFormType>()

  return (
    <Section
      title="Customer Portal"
      description="Customize how this product is presented in the customer portal"
      className={className}
    >
      <div className="flex w-full flex-col gap-y-6">
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
                      {/* eslint-disable-next-line no-restricted-syntax */}
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
                      {/* eslint-disable-next-line no-restricted-syntax */}
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
