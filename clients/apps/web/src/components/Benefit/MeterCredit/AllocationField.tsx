'use client'

import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import {
  RadioGroup,
  RadioGroupItem,
} from '@polar-sh/ui/components/ui/radio-group'
import { useFormContext } from 'react-hook-form'
import { meterCreditAllocationDisplayNames } from '../utils'

type Allocation = schemas['BenefitMeterCreditAllocation']

type AllocationFormValues = {
  properties: { allocation?: Allocation }
}

const OPTIONS: { value: Allocation; label: string; description: string }[] = [
  {
    value: 'per_claimed_seat',
    label: meterCreditAllocationDisplayNames.per_claimed_seat,
    description:
      'The units are granted for each claimed seat and pooled in the team balance. 5 claimed seats get 5 times the units.',
  },
  {
    value: 'team',
    label: meterCreditAllocationDisplayNames.team,
    description:
      'The units are granted once per purchase to the team, whatever the number of seats.',
  },
]

const AllocationOption = ({
  value,
  label,
  description,
  selected,
}: {
  value: Allocation
  label: string
  description: string
  selected: boolean
}) => {
  const id = `meter-credit-allocation-${value}`
  return (
    <Box
      as="label"
      htmlFor={id}
      flexDirection="column"
      borderRadius="l"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      display="flex"
      padding="l"
      backgroundColor={
        selected
          ? 'background-card'
          : { base: 'background-secondary', hover: 'background-card' }
      }
      transitionProperty="colors"
      transitionDuration="base"
      cursor={{ hover: 'pointer' }}
      rowGap="xs"
    >
      <Box alignItems="center" columnGap="s">
        <RadioGroupItem value={value} id={id} />
        <Text variant="default" color={selected ? 'default' : 'muted'}>
          {label}
        </Text>
      </Box>
      <Text variant="default" color="muted">
        {description}
      </Text>
    </Box>
  )
}

export const MeterCreditAllocationField = () => {
  const { control } = useFormContext<AllocationFormValues>()

  return (
    <FormField
      control={control}
      name="properties.allocation"
      defaultValue="per_claimed_seat"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Allocation on seat-based products</FormLabel>
          <FormDescription>
            Only applies to seat-based products. On other products, the units
            are granted once per purchase. It can&apos;t be changed once the
            benefit has been granted.
          </FormDescription>
          <FormControl>
            <RadioGroup
              value={field.value}
              onValueChange={field.onChange}
              className="grid grid-cols-1 gap-3"
            >
              {OPTIONS.map((option) => (
                <AllocationOption
                  key={option.value}
                  {...option}
                  selected={field.value === option.value}
                />
              ))}
            </RadioGroup>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
