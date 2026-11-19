'use client'

import { enums, schemas } from '@polar-sh/client'
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { Label } from '@polar-sh/ui/components/ui/label'
import { useState } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'

const trialIntervalValueDisplayNames: Record<
  schemas['TrialInterval'],
  [string, string]
> = {
  day: ['day', 'days'],
  week: ['week', 'weeks'],
  month: ['month', 'months'],
  year: ['year', 'years'],
}

export const TrialConfigurationForm = ({
  bottomText,
  variant = 'section',
}: {
  bottomText?: string
  variant?: 'section' | 'field'
}) => {
  const { control, setValue } = useFormContext<{
    trial_interval_count?: number | null
    trial_interval?: schemas['TrialInterval'] | null
    trial_payment_setup_required?: boolean | null
  }>()
  const count = useWatch({ control, name: 'trial_interval_count' })

  const [trialEnabled, setTrialEnabled] = useState<boolean>(!!count)
  const setTrial = (enabled: boolean) => {
    if (!enabled) {
      setValue('trial_interval', null)
      setValue('trial_interval_count', null)
      setValue('trial_payment_setup_required', null)
    } else {
      setValue('trial_interval', 'month')
      setValue('trial_interval_count', 1)
      setValue('trial_payment_setup_required', true)
    }
    setTrialEnabled(enabled)
  }

  const displayNameIndex = count && count > 1 ? 1 : 0

  return (
    <Box flexDirection="column" rowGap={variant === 'field' ? 's' : 'l'}>
      <Box alignItems="center" justifyContent="between" columnGap="s">
        {variant === 'field' ? (
          <Label>Free Trial Configuration</Label>
        ) : (
          <h3>Free Trial Configuration</h3>
        )}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setTrial(!trialEnabled)}
        >
          {trialEnabled ? 'Remove Trial' : 'Configure Trial'}
        </Button>
      </Box>
      {!trialEnabled && (
        <Box
          alignItems="center"
          justifyContent="center"
          borderRadius="l"
          borderWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
          padding="2xl"
          textAlign="center"
          color="text-secondary"
        >
          <span className="text-xs leading-snug">No trial configured</span>
        </Box>
      )}
      {trialEnabled && (
        <Box flexDirection="column" rowGap="l">
          <Box
            flexDirection={{ base: 'column', lg: 'row' }}
            alignItems={{ base: 'stretch', lg: 'center' }}
            justifyContent="between"
            rowGap="s"
            columnGap="m"
          >
            <FormLabel htmlFor="trial-interval-count">Trial duration</FormLabel>
            <Box columnGap="s" alignItems="start">
              <FormField
                control={control}
                name="trial_interval_count"
                rules={{
                  min: 1,
                  max: 1000,
                }}
                render={({ field }) => (
                  <FormItem>
                    <Box width={96}>
                      <FormControl>
                        <Input
                          id="trial-interval-count"
                          type="number"
                          min={1}
                          max={1000}
                          step={1}
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                    </Box>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="trial_interval"
                render={({ field }) => (
                  <FormItem>
                    <Box width={160}>
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
                                {
                                  trialIntervalValueDisplayNames[value][
                                    displayNameIndex
                                  ]
                                }
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                    </Box>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </Box>
          </Box>
          <FormField
            control={control}
            name="trial_payment_setup_required"
            render={({ field }) => (
              <FormItem>
                <Box
                  alignItems="center"
                  justifyContent="between"
                  columnGap="m"
                  minHeight={40}
                >
                  <FormLabel htmlFor="trial-payment-setup-required">
                    Require credit card up front
                  </FormLabel>
                  <FormControl>
                    <Switch
                      id="trial-payment-setup-required"
                      checked={field.value ?? true}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </Box>
              </FormItem>
            )}
          />
        </Box>
      )}
      {bottomText && trialEnabled && (
        <FormDescription>{bottomText}</FormDescription>
      )}
    </Box>
  )
}
