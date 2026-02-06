'use client'

import { useUpdateOrganization } from '@/hooks/queries'
import { useAutoSave } from '@/hooks/useAutoSave'
import { setValidationErrors } from '@/utils/api/errors'
import { isValidationError, schemas } from '@polar-sh/client'
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

interface OrganizationCurrencySettingsProps {
  organization: schemas['Organization']
}

type FormSchema = Pick<
  schemas['OrganizationUpdate'],
  'default_presentment_currency'
>

const OrganizationCurrencySettings: React.FC<
  OrganizationCurrencySettingsProps
> = ({ organization }) => {
  const form = useForm<FormSchema>({
    defaultValues: {
      default_presentment_currency: organization.default_presentment_currency,
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

    reset(data)
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
            title="Default Payment Currency"
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
        </SettingsGroup>
      </form>
    </Form>
  )
}

export default OrganizationCurrencySettings
