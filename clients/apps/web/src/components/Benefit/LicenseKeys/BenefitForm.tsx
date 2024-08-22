'use client'

import { BenefitCustomCreate } from '@polar-sh/sdk'
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
  const { control, watch, setValue } = useFormContext<BenefitCustomCreate>()

  const expires = watch('properties.expires', undefined)
  const limitActivations = watch('properties.limit_activations', undefined)
  const limitUsage = watch('properties.limit_usage', undefined)

  const [showLimitActivations, setShowLimitActivations] = useState(
    limitActivations !== undefined,
  )

  const [showLimitUsage, setShowLimitUsage] = useState(limitUsage !== undefined)

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
          render={({ field }) => {
            return (
              <FormItem>
                <Switch
                  id="license-key-ttl"
                  checked={field.value}
                  onCheckedChange={(expires) => {
                    const value = expires ? {} : undefined
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
        <>
          <FormField
            control={control}
            name="properties.expires.ttl"
            render={({ field }) => {
              return (
                <FormItem>
                  <div className="flex flex-row items-center justify-between">
                    <FormLabel>TTL</FormLabel>
                  </div>
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
                  <div className="flex flex-row items-center justify-between">
                    <FormLabel>Type</FormLabel>
                  </div>
                  <FormControl>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select timeframe" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="day">Days</SelectItem>
                        <SelectItem value="month">Months</SelectItem>
                        <SelectItem value="year">Years</SelectItem>
                      </SelectContent>
                    </Select>
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
          <label htmlFor="license-key-limit-usage">Usage limit</label>
        </div>
        <Switch
          id="license-key-limit-usage"
          checked={showLimitActivations}
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
                  <div className="flex flex-row items-center justify-between">
                    <FormLabel>Usage Limit</FormLabel>
                  </div>
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
          <label htmlFor="license-key-limit-activations">
            Activation Limits
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
                  <div className="flex flex-row items-center justify-between">
                    <FormLabel>Activation Limit</FormLabel>
                  </div>
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
