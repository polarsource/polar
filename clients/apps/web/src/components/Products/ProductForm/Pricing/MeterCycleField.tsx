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
} from '@polar-sh/orbit'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { useCallback, useEffect } from 'react'
import { useFormContext } from 'react-hook-form'
import { ProductFormType } from '../ProductForm'

const INVALID_MESSAGE = 'The meter cycle must evenly divide the billing cycle'

export interface MeterCycleFieldProps {
  disabled?: boolean
}

export const MeterCycleField = ({ disabled }: MeterCycleFieldProps) => {
  const { control, setValue, trigger, watch } =
    useFormContext<ProductFormType>()

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

  // Both cycles feed the divisibility rule, so re-run it whenever either moves —
  // otherwise a billing cycle edited after the meter cycle only surfaces on submit.
  useEffect(() => {
    if (enabled) {
      trigger('meter_interval')
    }
  }, [
    enabled,
    meterInterval,
    meterIntervalCount,
    billingInterval,
    billingIntervalCount,
    trigger,
  ])

  return (
    <div>
      <div className="flex flex-col gap-4">
        <FormItem>
          <div className="flex flex-row items-center justify-between space-y-0 space-x-2">
            <FormLabel htmlFor="meter-cycle-enable">
              Separate meter cycle
            </FormLabel>
            <FormControl>
              <Switch
                id="meter-cycle-enable"
                checked={enabled}
                onCheckedChange={onToggle}
                disabled={disabled}
              />
            </FormControl>
          </div>
        </FormItem>
        {enabled && (
          <div className="flex w-full flex-col gap-2 lg:flex-row">
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
                <FormItem className="w-full space-y-0 lg:w-1/3">
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={999}
                      step={1}
                      value={field.value ?? ''}
                      // Digits only, and keep every one the merchant typed: parsing a
                      // partial entry would store a cadence they didn't ask for.
                      onChange={(e) => {
                        const entered = e.target.value
                        if (!/^\d*$/.test(entered)) {
                          return
                        }
                        field.onChange(entered === '' ? null : Number(entered))
                      }}
                      disabled={disabled}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="meter_interval"
              rules={{ validate: () => dividesBillingCycle || INVALID_MESSAGE }}
              render={({ field }) => (
                <FormItem className="w-full space-y-0 lg:w-2/3">
                  <FormControl>
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
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}
      </div>
      <div className="mt-4">
        <FormDescription>
          Reset meters, grant meter credits and bill usage at a different pace
          than normal subscription renewal, like for instance yearly
          subscription renewals with monthly meter cycling
        </FormDescription>
      </div>
    </div>
  )
}
