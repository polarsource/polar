'use client'

import { enums, schemas } from '@polar-sh/client'
import Input from '@polar-sh/ui/components/atoms/Input'
import {
  FormControl,
  FormDescription,
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

const AGGREGATION_FUNCTIONS = [
  ...enums.countAggregationFuncValues,
  ...enums.propertyAggregationFuncValues,
  ...enums.uniqueAggregationFuncValues,
]

type AggregationFunction = (typeof AGGREGATION_FUNCTIONS)[number]

interface AggregationOption {
  value: AggregationFunction
  label: string
  description: string
}

const AGGREGATION_OPTIONS: AggregationOption[] = [
  {
    value: 'count',
    label: 'Count',
    description: 'Count the number of event occurrences',
  },
  {
    value: 'sum',
    label: 'Sum',
    description: 'Add up all values for a property',
  },
  {
    value: 'avg',
    label: 'Average',
    description: 'Take the average value for a property',
  },
  {
    value: 'min',
    label: 'Minimum',
    description:
      'Take the minimum value for a property across all event occurrences',
  },
  {
    value: 'max',
    label: 'Maximum',
    description:
      'Take the maximum value for a property across all event occurrences',
  },
  {
    value: 'unique',
    label: 'Unique',
    description: 'Count the number of unique property values',
  },
]

const AggregationRadioItem = ({
  option,
  isSelected,
}: {
  option: AggregationOption
  isSelected: boolean
}) => {
  const form = useFormContext<schemas['MeterCreate']>()
  const { control } = form

  const showPropertyInput = option.value !== 'count'

  return (
    <Label
      htmlFor={`aggregation-${option.value}`}
      className={`flex flex-col gap-3 rounded-lg border p-4 font-normal transition-colors ${
        isSelected
          ? 'dark:bg-polar-700 dark:border-polar-600/50 border-gray-300 bg-gray-50'
          : 'dark:border-polar-700 dark:hover:border-polar-700 dark:hover:bg-polar-700 dark:bg-polar-800 border-gray-100 hover:border-gray-300'
      }`}
    >
      <div className="flex items-start gap-3">
        <RadioGroupItem
          value={option.value}
          id={`aggregation-${option.value}`}
        />
        <div className="flex flex-1 flex-col gap-1">
          <span className="cursor-pointer font-medium">{option.label}</span>
          <p className="dark:text-polar-400 text-sm text-gray-600">
            {option.description}
          </p>
        </div>
      </div>
      {isSelected && showPropertyInput && (
        <FormField
          control={control}
          name="aggregation.property"
          rules={{
            required: 'This field is required',
          }}
          render={({ field }) => {
            return (
              <FormItem className="ml-7">
                <FormControl>
                  <Input
                    {...field}
                    value={field.value || ''}
                    placeholder="Over property"
                    autoComplete="off"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )
          }}
        />
      )}
    </Label>
  )
}

const MeterFormAggregation = () => {
  const form = useFormContext<schemas['MeterCreate']>()
  const { control } = form

  return (
    <FormItem>
      <FormLabel>Aggregation</FormLabel>
      <FormDescription>
        The function that will turn the filtered events into unit values.
      </FormDescription>
      <FormField
        control={control}
        name="aggregation.func"
        rules={{
          required: 'This field is required',
        }}
        render={({ field }) => {
          return (
            <FormItem>
              <FormControl>
                <div className="@container">
                  <RadioGroup
                    value={field.value}
                    onValueChange={field.onChange}
                    className="grid-cols-1 gap-3 @lg:grid-cols-2 @2xl:grid-cols-3"
                  >
                    {AGGREGATION_OPTIONS.map((option) => (
                      <AggregationRadioItem
                        key={option.value}
                        option={option}
                        isSelected={field.value === option.value}
                      />
                    ))}
                  </RadioGroup>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )
        }}
      />
    </FormItem>
  )
}

export default MeterFormAggregation
