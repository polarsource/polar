'use client'

import MeterFilterInput from '@/components/Meter/MeterFilterInput'
import MeterFormAggregation from '@/components/Meter/MeterFormAggregation'
import { schemas } from '@polar-sh/client'
import Input from '@polar-sh/ui/components/atoms/Input'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { useFormContext } from 'react-hook-form'

const MeterForm = ({ organizationId }: { organizationId: string }) => {
  const form = useFormContext<schemas['MeterCreate']>()
  const { control } = form

  return (
    <>
      <FormField
        control={control}
        name="name"
        rules={{
          minLength: {
            value: 3,
            message: 'This field must be at least 3 characters long',
          },
          required: 'This field is required',
        }}
        render={({ field }) => {
          return (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormDescription>
                Will be shown on customer&apos;s invoices and usage.
              </FormDescription>
              <FormControl>
                <Input
                  {...field}
                  value={field.value || ''}
                  autoComplete="off"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )
        }}
      />

      <FormItem>
        <FormLabel>Filters</FormLabel>
        <FormDescription>
          Specify how events are filtered before they are aggregated.
        </FormDescription>
        <MeterFilterInput prefix="filter" organizationId={organizationId} />
        <FormMessage />
      </FormItem>

      <MeterFormAggregation organizationId={organizationId} />
    </>
  )
}

export default MeterForm
