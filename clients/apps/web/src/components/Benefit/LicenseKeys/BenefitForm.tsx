'use client'

import { schemas } from '@polar-sh/client'
import { Input } from '@polar-sh/orbit'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/orbit'
import { Switch } from '@polar-sh/orbit'
import { Checkbox } from '@polar-sh/orbit'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { useState } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'

export const LicenseKeysBenefitForm = () => {
  const { control, setValue } =
    useFormContext<schemas['BenefitLicenseKeysCreate']>()

  const expires = useWatch({ control, name: 'properties.expires' })
  const showExpirationFields = !!expires
  const defaultExpiration: schemas['BenefitLicenseKeyExpirationProperties'] = {
    ttl: 1,
    timeframe: 'year',
  }

  const activations = useWatch({ control, name: 'properties.activations' })
  const showActivationFields = !!activations
  const defaultActivations: schemas['BenefitLicenseKeyActivationProperties'] = {
    limit: 5,
    enable_customer_admin: true,
  }

  const limitUsage = useWatch({ control, name: 'properties.limit_usage' })
  const [showLimitUsage, setShowLimitUsage] = useState(!!limitUsage)

  return (
    <>
      <FormField
        control={control}
        name="properties.prefix"
        render={({ field }) => {
          const value = field.value || ''
          return (
            <FormItem className="flex flex-col gap-y-2">
              <div className="flex flex-col gap-y-2">
                <FormLabel>Key prefix</FormLabel>
                <FormDescription>
                  A prefix to identify license keys
                </FormDescription>
              </div>
              <FormControl>
                <Input type="text" {...{ ...field, value }} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )
        }}
      />

      <FormField
        control={control}
        name="properties.expires"
        render={() => {
          return (
            <FormItem>
              <div className="flex flex-row items-center">
                <div className="grow">
                  <label htmlFor="license-key-ttl">Expires</label>
                </div>
                <Switch
                  id="license-key-ttl"
                  checked={showExpirationFields}
                  onCheckedChange={(enabled) => {
                    const value = enabled ? defaultExpiration : undefined
                    setValue('properties.expires', value)
                  }}
                />
              </div>
              <FormDescription>
                Expiration only applies to keys granted by one-time purchases.
                Subscription-backed keys stay valid for as long as the
                subscription is active.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )
        }}
      />
      {expires && (
        <div className="flex flex-col gap-y-2">
          <div className="flex flex-row space-x-4">
            <FormField
              control={control}
              name="properties.expires.ttl"
              render={({ field }) => {
                return (
                  <FormItem className="w-full max-w-full">
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )
              }}
            />
            <FormField
              control={control}
              name="properties.expires.timeframe"
              render={({ field }) => {
                return (
                  <FormItem>
                    <FormControl>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select timeframe" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="day">Day</SelectItem>
                          <SelectItem value="month">Month</SelectItem>
                          <SelectItem value="year">Year</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )
              }}
            />
          </div>
        </div>
      )}

      <div className="flex flex-row items-center">
        <div className="grow">
          <label htmlFor="license-key-activations">Limit Activations</label>
        </div>
        <Switch
          id="license-key-activations"
          checked={showActivationFields}
          onCheckedChange={(enabled) => {
            const value = enabled ? defaultActivations : undefined
            setValue('properties.activations', value)
          }}
        />
      </div>
      {activations && (
        <>
          <FormField
            control={control}
            name="properties.activations.limit"
            render={({ field }) => {
              return (
                <FormItem>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )
            }}
          />

          <div className="flex flex-row items-center gap-x-3">
            <FormField
              control={control}
              name="properties.activations.enable_customer_admin"
              render={({ field }) => {
                return (
                  <FormItem>
                    <Checkbox
                      id="license-key-activations-customer-admin"
                      checked={field.value}
                      onCheckedChange={(checked) => {
                        // String | boolean type for some reason
                        const value = checked ? true : false
                        setValue(
                          'properties.activations.enable_customer_admin',
                          value,
                        )
                      }}
                    />
                    <FormMessage />
                  </FormItem>
                )
              }}
            />
            <label
              htmlFor="license-key-activations-user-admin"
              className="-mt-2 text-sm"
            >
              Enable user to deactivate instances via Polar
            </label>
          </div>
        </>
      )}

      <div className="flex flex-row items-center">
        <div className="grow">
          <label htmlFor="license-key-limit-usage">Limit Usage</label>
        </div>
        <Switch
          id="license-key-limit-usage"
          checked={showLimitUsage}
          onCheckedChange={(show) => {
            const value = show ? 1 : undefined
            setValue('properties.limit_usage', value)
            setShowLimitUsage(show)
          }}
        />
      </div>
      {showLimitUsage && (
        <FormField
          control={control}
          name="properties.limit_usage"
          render={({ field }) => {
            const value = field.value || ''
            return (
              <FormItem>
                <FormControl>
                  <Input type="number" {...{ ...field, value }} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )
          }}
        />
      )}
    </>
  )
}
