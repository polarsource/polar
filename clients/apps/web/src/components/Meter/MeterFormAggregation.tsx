'use client'

import { enums, schemas } from '@polar-sh/client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
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

type AggregationFunction =
  | (typeof enums.countAggregationFuncValues)[number]
  | (typeof enums.propertyAggregationFuncValues)[number]
  | (typeof enums.uniqueAggregationFuncValues)[number]

const AGGREGATION_LABELS: Record<AggregationFunction, string> = {
  count: 'Count',
  sum: 'Sum',
  avg: 'Average',
  min: 'Minimum',
  max: 'Maximum',
  unique: 'Unique',
}

const ALL_AGGREGATION_FUNCTIONS: AggregationFunction[] = [
  'count',
  'sum',
  'avg',
  'min',
  'max',
  'unique',
]

const MeterFormAggregation = () => {
  const { control, watch } = useFormContext<schemas['MeterCreate']>()
  const func = watch('aggregation.func')
  const needsProperty = func && func !== 'count'

  return (
    <div className="flex flex-col gap-3">
      <FormField
        control={control}
        name="aggregation.func"
        rules={{ required: 'This field is required' }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Aggregation</FormLabel>
            <FormDescription>
              How filtered events are reduced to a single value.
            </FormDescription>
            <FormControl>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a function" />
                </SelectTrigger>
                <SelectContent>
                  {ALL_AGGREGATION_FUNCTIONS.map((fn) => (
                    <SelectItem key={fn} value={fn}>
                      {AGGREGATION_LABELS[fn]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      {needsProperty && (
        <FormField
          control={control}
          name="aggregation.property"
          rules={{ required: 'This field is required' }}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  {...field}
                  value={field.value || ''}
                  placeholder="Property name"
                  autoComplete="off"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </div>
  )
}

export default MeterFormAggregation
