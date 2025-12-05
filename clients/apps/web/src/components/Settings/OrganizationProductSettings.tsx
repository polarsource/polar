import { useUpdateOrganization } from '@/hooks/queries'
import { useAutoSave } from '@/hooks/useAutoSave'
import { setValidationErrors } from '@/utils/api/errors'
import { isValidationError, schemas } from '@polar-sh/client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/ui/select'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import React from 'react'
import { useForm } from 'react-hook-form'
import { toast } from '../Toast/use-toast'
import { SettingsGroup, SettingsGroupItem } from './SettingsGroup'

interface OrganizationProductSettingsProps {
  organization: schemas['Organization']
}

const CURRENCIES = [
  { value: 'usd', label: 'US Dollar (USD)' },
  { value: 'eur', label: 'Euro (EUR)' },
] as const

const OrganizationProductSettings: React.FC<OrganizationProductSettingsProps> =
  ({ organization }) => {
    const form = useForm<schemas['OrganizationProductSettings']>({
      defaultValues: organization.product_settings,
    })
    const { control, setError, reset } = form

    const updateOrganization = useUpdateOrganization()
    const onSave = async (
      product_settings: schemas['OrganizationProductSettings'],
    ) => {
      const { data, error } = await updateOrganization.mutateAsync({
        id: organization.id,
        body: {
          product_settings,
        },
      })

      if (error) {
        if (isValidationError(error.detail)) {
          setValidationErrors(error.detail, setError)
        } else {
          setError('root', { message: error.detail })
        }

        toast({
          title: 'Product Settings Update Failed',
          description: `Error updating product settings: ${error.detail}`,
        })

        return
      }

      reset(data.product_settings)
    }

    useAutoSave({
      form,
      onSave,
      delay: 1000,
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
              title="Default currency"
              description="Currency used by default when creating new products."
            >
              <FormField
                control={control}
                name="default_currency"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CURRENCIES.map((currency) => (
                            <SelectItem
                              key={currency.value}
                              value={currency.value}
                            >
                              {currency.label}
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

export default OrganizationProductSettings
