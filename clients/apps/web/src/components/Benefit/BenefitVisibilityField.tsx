'use client'

import { schemas } from '@polar-sh/client'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { RadioGroup } from '@polar-sh/ui/components/ui/radio-group'
import { useFormContext } from 'react-hook-form'
import { BenefitRadioOption } from './BenefitRadioOption'

type BenefitVisibilityFormValues = {
  visibility?: schemas['BenefitVisibility']
}

interface BenefitVisibilityFieldProps {
  defaultValue?: schemas['BenefitVisibility']
}

export const BenefitVisibilityField = ({
  defaultValue,
}: BenefitVisibilityFieldProps) => {
  const { control } = useFormContext<BenefitVisibilityFormValues>()

  return (
    <FormField
      control={control}
      name="visibility"
      shouldUnregister
      defaultValue={defaultValue}
      render={({ field }) => (
        <FormItem>
          <FormLabel>Visibility</FormLabel>
          <FormControl>
            <RadioGroup
              value={field.value}
              onValueChange={field.onChange}
              className="grid grid-cols-1 gap-3"
            >
              <BenefitRadioOption
                id="benefit-visibility-public"
                value="public"
                selected={field.value === 'public'}
                label="Visible"
                description="Customers can see this benefit after purchase, including in order confirmations and the Customer Portal."
              />
              <BenefitRadioOption
                id="benefit-visibility-private"
                value="private"
                selected={field.value === 'private'}
                label="Hidden"
                description="Granted after purchase, but is never shown to customers."
              />
            </RadioGroup>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
