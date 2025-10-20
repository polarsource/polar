'use client'

import { enums, schemas } from '@polar-sh/client'
import Input from '@polar-sh/ui/components/atoms/Input'
import Switch from '@polar-sh/ui/components/atoms/Switch'

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
import { useCallback, useMemo, useState } from 'react'
import { useFormContext } from 'react-hook-form'

const trialIntervalValueDisplayNames: Record<
  schemas['TrialInterval'],
  [string, string]
> = {
  day: ['Day', 'Days'],
  week: ['Week', 'Weeks'],
  month: ['Month', 'Months'],
  year: ['Year', 'Years'],
}

export const TrialConfigurationForm = ({
  bottomText,
}: {
  bottomText?: string
}) => {
  const { control, watch, setValue } = useFormContext<{
    trial_interval_count?: number | null
    trial_interval?: schemas['TrialInterval'] | null
  }>()
  const count = watch('trial_interval_count')
  const interval = watch('trial_interval')

  const [trialEnabled, setTrialEnabled] = useState<boolean>(
    !!count && !!interval,
  )
  const onTrialToggle = useCallback(
    (enabled: boolean) => {
      if (!enabled) {
        setValue('trial_interval', null)
        setValue('trial_interval_count', null)
      } else {
        // Set a default value that clicks for the user
        setValue('trial_interval', 'month')
        setValue('trial_interval_count', 1)
      }
      setTrialEnabled(enabled)
    },
    [setValue],
  )

  const intervalDisplayNames = useMemo<
    Record<schemas['TrialInterval'], string>
  >(() => {
    const index = count && count > 1 ? 1 : 0
    return Object.fromEntries(
      enums.trialIntervalValues.map((value) => [
        value,
        trialIntervalValueDisplayNames[value][index],
      ]),
    ) as Record<schemas['TrialInterval'], string>
  }, [count])

  return (
    <div className="flex w-full flex-col gap-y-6">
      <FormItem>
        <div className="flex flex-row items-center justify-between space-y-0 space-x-2">
          <FormLabel htmlFor="trial-enable">Enable free trial period</FormLabel>
          <Switch
            id="trial-enable"
            checked={trialEnabled}
            onCheckedChange={onTrialToggle}
          />
        </div>
      </FormItem>
      {trialEnabled && (
        <>
          <div className="flex w-full flex-col gap-2 lg:flex-row">
            <FormField
              control={control}
              name="trial_interval_count"
              rules={{
                min: 1,
                max: 1000,
              }}
              render={({ field }) => (
                <FormItem className="w-full lg:w-1/3">
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={1000}
                      step={1}
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="trial_interval"
              render={({ field }) => {
                return (
                  <FormItem className="w-full lg:w-2/3">
                    <FormControl>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || ''}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select an interval" />
                        </SelectTrigger>
                        <SelectContent>
                          {enums.trialIntervalValues.map((value) => (
                            <SelectItem key={value} value={value}>
                              {intervalDisplayNames[value]}
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
          </div>
          {bottomText && <FormDescription>{bottomText}</FormDescription>}
        </>
      )}
    </div>
  )
}
