'use client'

import { schemas } from '@polar-sh/client'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { RadioGroup } from '@polar-sh/ui/components/ui/radio-group'
import { useFormContext } from 'react-hook-form'
import { BenefitRadioOption } from '../BenefitRadioOption'

interface GrantTargetFieldProps {
  update: boolean
}

export const GrantTargetField = ({ update }: GrantTargetFieldProps) => {
  const { control } = useFormContext<schemas['BenefitMeterCreditCreate']>()

  return (
    <FormField
      control={control}
      name="grant_target"
      shouldUnregister
      defaultValue={update ? undefined : 'customer'}
      render={({ field }) => (
        <FormItem>
          <FormLabel>Seat-based products</FormLabel>
          <FormControl>
            <RadioGroup
              value={field.value}
              onValueChange={field.onChange}
              disabled={update}
              className="grid grid-cols-1 gap-3"
            >
              <BenefitRadioOption
                id="benefit-grant-target-customer"
                value="customer"
                selected={field.value === 'customer'}
                label="Shared by the team"
                description="Credits the units once per customer. All seats draw from the same balance."
              />
              <BenefitRadioOption
                id="benefit-grant-target-member"
                value="member"
                selected={field.value === 'member'}
                label="Per seat"
                description="Credits the units for every claimed seat, added to the same balance."
              />
            </RadioGroup>
          </FormControl>
          <FormMessage />
          <FormDescription>
            {update
              ? "This can't be changed after the benefit is created."
              : "Products without seats always credit the customer. This can't be changed later."}
          </FormDescription>
        </FormItem>
      )}
    />
  )
}
