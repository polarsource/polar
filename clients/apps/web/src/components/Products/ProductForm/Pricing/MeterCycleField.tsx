'use client'

import {
  defaultMeterInterval,
  meterIntervalDividesBillingInterval,
} from '@/utils/meterInterval'
import { enums } from '@polar-sh/client'
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Text,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { FormField } from '@polar-sh/ui/components/ui/form'
import { useCallback } from 'react'
import { useFormContext } from 'react-hook-form'
import { ProductFormType } from '../ProductForm'

const INVALID_MESSAGE = 'The meter cycle must evenly divide the billing cycle'

export interface MeterCycleFieldProps {
  disabled?: boolean
}

export const MeterCycleField = ({ disabled }: MeterCycleFieldProps) => {
  const { control, setValue, watch } = useFormContext<ProductFormType>()

  const billingInterval = watch('recurring_interval')
  const billingIntervalCount = watch('recurring_interval_count')
  const meterInterval = watch('meter_interval')
  const meterIntervalCount = watch('meter_interval_count')

  const enabled = !!meterInterval

  const onToggle = useCallback(
    (checked: boolean) => {
      if (!checked) {
        setValue('meter_interval', null)
        setValue('meter_interval_count', null)
        return
      }
      setValue(
        'meter_interval',
        defaultMeterInterval(billingInterval ?? 'month'),
      )
      setValue('meter_interval_count', 1)
    },
    [setValue, billingInterval],
  )

  const dividesBillingCycle =
    !meterInterval ||
    !billingInterval ||
    meterIntervalDividesBillingInterval(
      meterInterval,
      Number(meterIntervalCount ?? 1),
      billingInterval,
      Number(billingIntervalCount ?? 1),
    )

  return (
    <Box flexDirection="column" rowGap="l">
      <Box alignItems="center" justifyContent="between" columnGap="l">
        <Box
          as="label"
          htmlFor="meter-cycle-enable"
          display="flex"
          flexDirection="column"
          rowGap="xs"
        >
          <Text as="span" variant="label">
            Separate meter cycle
          </Text>
          <Text as="span" variant="caption" color="muted">
            Reset meters, grant meter credits and bill usage at a different pace
            than normal subscription renewal, like for instance yearly
            subscription renewals with monthly meter cycling
          </Text>
        </Box>
        <Switch
          id="meter-cycle-enable"
          checked={enabled}
          onCheckedChange={onToggle}
          disabled={disabled}
        />
      </Box>
      {enabled && (
        <Box flexDirection="column" rowGap="s">
          <Box alignItems="center" columnGap="m">
            <Text variant="caption">Every</Text>
            <FormField
              control={control}
              name="meter_interval_count"
              rules={{
                required: 'This field is required when a meter cycle is set',
                min: { value: 1, message: 'Interval count must be at least 1' },
                max: {
                  value: 999,
                  message: 'Interval count cannot exceed 999',
                },
              }}
              render={({ field }) => (
                <Input
                  type="text"
                  pattern="\d*"
                  value={field.value ?? ''}
                  onChange={(e) => {
                    const parsedValue = parseInt(e.target.value)
                    field.onChange(isNaN(parsedValue) ? '' : parsedValue)
                  }}
                  disabled={disabled}
                  className="min-w-12"
                />
              )}
            />
            <FormField
              control={control}
              name="meter_interval"
              rules={{ validate: () => dividesBillingCycle || INVALID_MESSAGE }}
              render={({ field }) => (
                <Box>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? ''}
                    disabled={disabled}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a meter cycle" />
                    </SelectTrigger>
                    <SelectContent>
                      {enums.recurringIntervalValues.map((value) => (
                        <SelectItem key={value} value={value}>
                          {value}
                          {meterIntervalCount !== 1 ? 's' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Box>
              )}
            />
          </Box>
          {!dividesBillingCycle && (
            <Text variant="caption" color="error">
              {INVALID_MESSAGE}
            </Text>
          )}
        </Box>
      )}
    </Box>
  )
}
