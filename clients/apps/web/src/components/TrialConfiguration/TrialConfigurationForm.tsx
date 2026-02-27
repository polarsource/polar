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
import { twMerge } from 'tailwind-merge'

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
    // eslint-disable-next-line no-restricted-syntax
    <label
      className={twMerge(
        'w-full cursor-pointer rounded-2xl border p-4 transition-colors',
        trialEnabled
          ? 'dark:bg-polar-800 bg-gray-50'
          : 'dark:border-polar-700 dark:hover:border-polar-700 dark:text-polar-500 dark:hover:bg-polar-700 dark:bg-polar-900 border-gray-100 text-gray-500 hover:border-gray-200',
      )}
      htmlFor="trial-enable"
    >
      <div className="flex flex-row items-center gap-x-6">
        <FormItem className="flex-1">
          <div className="flex h-10 flex-row items-center justify-start space-y-0 space-x-2 whitespace-nowrap">
            <Switch
              id="trial-enable"
              checked={trialEnabled}
              onCheckedChange={onTrialToggle}
            />
            <FormLabel htmlFor="trial-enable">Free trial period</FormLabel>
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
                  <FormItem className="w-full space-y-0 lg:w-1/3">
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
                    <FormItem className="w-full space-y-0 lg:w-2/3">
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
          </>
        )}
      </div>
      {bottomText && trialEnabled && (
        <div className="mt-4">
          <FormDescription>{bottomText}</FormDescription>
        </div>
      )}
    </label>
  )
}
