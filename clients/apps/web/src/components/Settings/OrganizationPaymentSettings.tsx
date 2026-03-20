'use client'

import { useUpdateOrganization } from '@/hooks/queries'
import { useAutoSave } from '@/hooks/useAutoSave'
import { setValidationErrors } from '@/utils/api/errors'
import { enums, isValidationError, schemas } from '@polar-sh/client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import React from 'react'
import { useForm } from 'react-hook-form'
import { CurrencySelector } from '../CurrencySelector'
import { SettingsGroup, SettingsGroupItem } from './SettingsGroup'

interface OrganizationPaymentSettingsProps {
  organization: schemas['Organization']
}

type FormSchema = Pick<
  schemas['OrganizationUpdate'],
  'default_presentment_currency' | 'default_tax_behavior'
>

const taxBehaviorOptionDisplayNames: Record<
  schemas['TaxBehaviorOption'],
  string
> = {
  exclusive: 'Exclusive',
  inclusive: 'Inclusive',
  location: 'Location based',
}

const OrganizationPaymentSettings: React.FC<
  OrganizationPaymentSettingsProps
> = ({ organization: _organization }) => {
  const organization = _organization as schemas['Organization'] & {
    default_presentment_currency: schemas['PresentmentCurrency']
  }
  const form = useForm<FormSchema>({
    defaultValues: {
      default_presentment_currency: organization.default_presentment_currency,
      default_tax_behavior: organization.default_tax_behavior,
    },
  })
  const { control, setError, reset } = form

  const updateOrganization = useUpdateOrganization()
  const onSave = async (body: FormSchema) => {
    const { data, error } = await updateOrganization.mutateAsync({
      id: organization.id,
      body,
    })

    if (error) {
      if (isValidationError(error.detail)) {
        setValidationErrors(error.detail, setError)
      } else {
        setError('root', { message: error.detail })
      }
      return
    }

    reset({
      ...data,
      default_presentment_currency:
        data.default_presentment_currency as schemas['PresentmentCurrency'],
    })
  }

  useAutoSave({
    form,
    onSave,
    delay: 200,
  })

  return (
    <Form {...form}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
        }}
      >
        <SettingsGroup>
          <SettingsGroupItem
            title="Default payment currency"
            description="The default currency for products and checkout. Used as fallback if the customer's local currency is not available or defined on a product."
          >
            <FormField
              control={control}
              name="default_presentment_currency"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <CurrencySelector
                      value={field.value as schemas['PresentmentCurrency']}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </SettingsGroupItem>
          <SettingsGroupItem
            title="Default tax behavior"
            description="The default tax behavior applied on products."
          >
            <FormField
              control={control}
              name="default_tax_behavior"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value || undefined}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a benefit type" />
                      </SelectTrigger>
                      <SelectContent>
                        {enums.taxBehaviorOptionValues.map((value) => (
                          <SelectItem key={value} value={value}>
                            {taxBehaviorOptionDisplayNames[value]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </SettingsGroupItem>
        </SettingsGroup>
      </form>
    </Form>
  )
}

export default OrganizationPaymentSettings
