'use client'

import { BenefitCustomCreate, Organization } from '@polar-sh/sdk'
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
import { useFormContext } from 'react-hook-form'

const LicenseKeysForm = ({ organization }: { organization: Organization }) => {
  const { control, watch, getValues, setValue } =
    useFormContext<BenefitCustomCreate>()

  const showExpiration = watch('properties.expires', false)
  const showLimitation = watch('properties.limited', false)

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
                  onCheckedChange={(expires) =>
                    setValue('properties.expires', expires)
                  }
                />
                <FormMessage />
              </FormItem>
            )
          }}
        />
      </div>
      {showExpiration && (
        <>
          <FormField
            control={control}
            name="properties.ttl"
            render={({ field }) => {
              return (
                <FormItem>
                  <div className="flex flex-row items-center justify-between">
                    <FormLabel>Limit</FormLabel>
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
            name="properties.timeframe"
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
          <label htmlFor="license-key-limit">Activation Limits</label>
        </div>
        <FormField
          control={control}
          name="properties.limited"
          render={({ field }) => {
            return (
              <FormItem>
                <Switch
                  id="license-key-limit"
                  checked={field.value}
                  onCheckedChange={(limited) =>
                    setValue('properties.limited', limited)
                  }
                  {...field}
                />
                <FormMessage />
              </FormItem>
            )
          }}
        />
      </div>
      {showLimitation && (
        <>
          <FormField
            control={control}
            name="properties.activation_limit"
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

interface LicenseKeysBenefitFormProps {
  organization: Organization
  update?: boolean
}

const LicenseKeysEditForm = ({ organization }: LicenseKeysBenefitFormProps) => {
  return <LicenseKeysForm organization={organization} />
}

export const LicenseKeysBenefitForm = ({
  organization,
  update = false,
}: LicenseKeysBenefitFormProps) => {
  if (!update) {
    return <LicenseKeysForm organization={organization} />
  }

  return <LicenseKeysEditForm organization={organization} />
}
