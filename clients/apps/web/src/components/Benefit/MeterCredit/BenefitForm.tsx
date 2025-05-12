'use client'

import { useMeters } from '@/hooks/queries/meters'
import { schemas } from '@polar-sh/client'
import Input from '@polar-sh/ui/components/atoms/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import { Checkbox } from '@polar-sh/ui/components/ui/checkbox'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { useFormContext } from 'react-hook-form'

export const MeterCreditBenefitForm = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const { data: meters } = useMeters(organization.id, {
    sorting: ['name'],
  })
  const { control } = useFormContext<schemas['BenefitMeterCreditCreate']>()

  return (
    <>
      {meters && meters.items && (
        <FormField
          control={control}
          name="properties.meter_id"
          rules={{
            required: 'This field is required',
          }}
          render={({ field }) => {
            return (
              <FormItem>
                <FormLabel>Meter</FormLabel>
                <FormControl>
                  <Select {...field} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a meter" />
                    </SelectTrigger>
                    <SelectContent>
                      {meters.items.map((meter) => (
                        <SelectItem key={meter.id} value={meter.id}>
                          {meter.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )
          }}
        />
      )}
      <FormField
        control={control}
        name="properties.units"
        rules={{
          min: 0,
          required: 'This field is required',
        }}
        render={({ field }) => {
          return (
            <FormItem>
              <FormLabel>Number of credited units</FormLabel>
              <FormControl>
                <Input type="number" {...field} />
              </FormControl>
              <FormMessage />
              <FormDescription>
                If the billing cycle is recurring, units will be credited at the
                beginning of each period.
              </FormDescription>
            </FormItem>
          )
        }}
      />
      <FormField
        control={control}
        name="properties.rollover"
        defaultValue={false}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Rollover unused credits</FormLabel>
            <FormControl>
              <div className="flex flex-row items-center gap-x-2">
                <Checkbox
                  defaultChecked={field.value}
                  onCheckedChange={field.onChange}
                />
                <p className="text-sm">
                  Rollover unused credits to the next billing cycle
                </p>
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  )
}
