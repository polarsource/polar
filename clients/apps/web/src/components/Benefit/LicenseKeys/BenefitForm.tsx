'use client'

import {
  BenefitLicenseKeyActivationProperties,
  BenefitLicenseKeyExpirationProperties,
  BenefitLicenseKeysCreate,
} from '@polar-sh/sdk'
import { Switch } from 'polarkit/components/ui/atoms'
import Input from 'polarkit/components/ui/atoms/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'polarkit/components/ui/atoms/select'
import { Checkbox } from 'polarkit/components/ui/checkbox'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from 'polarkit/components/ui/form'
import { useState } from 'react'
import { useFormContext } from 'react-hook-form'

export const LicenseKeysBenefitForm = () => {
  const { control, watch, setValue } =
    useFormContext<BenefitLicenseKeysCreate>()

  const expires = watch('properties.expires', undefined)
  const showExpirationFields = expires !== undefined
  const defaultExpiration: BenefitLicenseKeyExpirationProperties = {
    ttl: 1,
    timeframe: 'year',
  }

  const activations = watch('properties.activations', undefined)
  const showActivationFields = activations !== undefined
  const defaultActivations: BenefitLicenseKeyActivationProperties = {
    limit: 5,
    enable_user_admin: true,
  }

  const limitUsage = watch('properties.limit_usage', undefined)
  const [showLimitUsage, setShowLimitUsage] = useState(limitUsage !== undefined)

  return (
    <>
      <FormField
        control={control}
        name="properties.prefix"
        render={({ field }) => {
          const value = field.value || ''
          return (
            <FormItem>
              <div className="flex flex-row items-center justify-between">
                <FormLabel>Key prefix</FormLabel>
              </div>
              <FormControl>
                <Input type="text" {...{ ...field, value }} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )
        }}
      />

      <div className="flex flex-row items-center">
        <div className="grow">
          <label htmlFor="license-key-ttl">Expires</label>
        </div>
        <FormField
          control={control}
          name="properties.expires"
          render={() => {
            return (
              <FormItem>
                <Switch
                  id="license-key-ttl"
                  checked={showExpirationFields}
                  onCheckedChange={(enabled) => {
                    const value = enabled ? defaultExpiration : undefined
                    setValue('properties.expires', value)
                  }}
                />
                <FormMessage />
              </FormItem>
            )
          }}
        />
      </div>
      {expires && (
        <div className="flex flex-row space-x-4">
          <FormField
            control={control}
            name="properties.expires.ttl"
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
          <FormField
            control={control}
            name="properties.expires.timeframe"
            shouldUnregister={true}
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

          <div className="flex flex-row items-center space-x-4">
            <FormField
              control={control}
              name="properties.activations.enable_user_admin"
              render={({ field }) => {
                return (
                  <FormItem>
                    <Checkbox
                      id="license-key-activations-user-admin"
                      checked={field.value}
                      onCheckedChange={(checked) => {
                        // String | boolean type for some reason
                        const value = checked ? true : false
                        setValue(
                          'properties.activations.enable_user_admin',
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
        <>
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
        </>
      )}
    </>
  )
}
