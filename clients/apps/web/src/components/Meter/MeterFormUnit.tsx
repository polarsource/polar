'use client'

import { enums, schemas } from '@polar-sh/client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { useFormContext } from 'react-hook-form'

type MeterUnit = (typeof enums.meterUnitValues)[number]

const UNIT_LABELS: Record<MeterUnit, string> = {
  scalar: 'Scalar',
  tokens: 'Tokens',
  bytes: 'Bytes',
}

const MeterFormUnit = () => {
  const { control } = useFormContext<schemas['MeterCreate']>()

  return (
    <FormField
      control={control}
      name="unit"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Unit</FormLabel>
          <FormDescription>
            Determines what the aggregated value represents.
          </FormDescription>
          <FormControl>
            <Select
              value={field.value ?? 'scalar'}
              onValueChange={field.onChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a unit" />
              </SelectTrigger>
              <SelectContent>
                {enums.meterUnitValues.map((unit) => (
                  <SelectItem key={unit} value={unit}>
                    {UNIT_LABELS[unit]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

export default MeterFormUnit
