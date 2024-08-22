'use client'

import {
  BenefitLicenseKeyExpiration,
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
  const limitActivations = watch('properties.limit_activations', undefined)
  const limitUsage = watch('properties.limit_usage', undefined)

  const [showLimitActivations, setShowLimitActivations] = useState(
    limitActivations !== undefined,
  )
  const [showLimitUsage, setShowLimitUsage] = useState(limitUsage !== undefined)

  const showExpirationFields = expires !== undefined
  const defaultExpiration: BenefitLicenseKeyExpiration = {
    ttl: 1,
    timeframe: 'year',
  }

  return (
    <>
      <FormField
        control={control}
        name="properties.prefix"
        render={({ field }) => {
          return (
            <FormItem>
              <div className="flex flex-row items-center justify-between">
                <FormLabel>Key prefix</FormLabel>
              </div>
              <FormControl>
                <Input {...field} />
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
                  onCheckedChange={(expires) => {
                    const value = expires ? defaultExpiration : undefined
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
          <label htmlFor="license-key-limit-activations">
            Limit Activations
          </label>
        </div>
        <Switch
          id="license-key-limit-activations"
          checked={showLimitActivations}
          onCheckedChange={(show) => {
            const value = show ? 1 : undefined
            setValue('properties.limit_activations', value)
            setShowLimitActivations(show)
          }}
        />
      </div>
      {showLimitActivations && (
        <>
          <FormField
            control={control}
            name="properties.limit_activations"
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
        </>
      )}
    </>
  )
}
