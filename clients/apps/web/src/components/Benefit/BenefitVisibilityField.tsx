'use client'

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
import { schemas } from '@polar-sh/client'
import { useFormContext } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'

type BenefitVisibilityFormValues = {
  visibility?: schemas['BenefitVisibility']
}

const visibilityCardClass = (selected: boolean) =>
  twMerge(
    'flex flex-col gap-2 rounded-2xl border p-4 font-normal transition-colors',
    selected
      ? 'dark:bg-polar-800 bg-gray-50'
      : 'dark:border-polar-700 dark:hover:border-polar-700 dark:text-polar-500 dark:hover:bg-polar-700 dark:bg-polar-900 border-gray-100 text-gray-500 hover:border-gray-200',
  )

export const BenefitVisibilityField = () => {
  const { control } = useFormContext<BenefitVisibilityFormValues>()

  return (
    <FormField
      control={control}
      name="visibility"
      shouldUnregister
      render={({ field }) => (
        <FormItem>
          <FormLabel>Visibility</FormLabel>
          <FormControl>
            <RadioGroup
              value={field.value}
              onValueChange={field.onChange}
              className="grid grid-cols-1 gap-3"
            >
              <Label
                htmlFor="benefit-visibility-public"
                className={visibilityCardClass(field.value === 'public')}
              >
                <div className="flex items-center gap-2.5 font-medium">
                  <RadioGroupItem
                    value="public"
                    id="benefit-visibility-public"
                  />
                  Visible
                </div>
                <p className="dark:text-polar-500 text-sm text-gray-500">
                  Shown in the customer portal
                </p>
              </Label>
              <Label
                htmlFor="benefit-visibility-private"
                className={visibilityCardClass(field.value === 'private')}
              >
                <div className="flex items-center gap-2.5 font-medium">
                  <RadioGroupItem
                    value="private"
                    id="benefit-visibility-private"
                  />
                  Hidden
                </div>
                <p className="dark:text-polar-500 text-sm text-gray-500">
                  Granted but not shown in the customer portal
                </p>
              </Label>
            </RadioGroup>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
