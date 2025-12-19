import { useUpdateOrganization } from '@/hooks/queries'
import { useAutoSave } from '@/hooks/useAutoSave'
import { setValidationErrors } from '@/utils/api/errors'
import { isValidationError, schemas } from '@polar-sh/client'
import Switch from '@polar-sh/ui/components/atoms/Switch'
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

interface OrganizationCustomerPortalSettingsProps {
  organization: schemas['Organization']
}

const OrganizationCustomerPortalSettings: React.FC<
  OrganizationCustomerPortalSettingsProps
> = ({ organization }) => {
  const form = useForm<schemas['OrganizationCustomerPortalSettings']>({
    defaultValues: organization.customer_portal_settings,
  })
  const { control, setError, reset } = form

  const updateOrganization = useUpdateOrganization()
  const onSave = async (
    customer_portal_settings: schemas['OrganizationCustomerPortalSettings'],
  ) => {
    const { data, error } = await updateOrganization.mutateAsync({
      id: organization.id,
      body: {
        customer_portal_settings,
      },
    })

    if (error) {
      if (isValidationError(error.detail)) {
        setValidationErrors(error.detail, setError)
      } else {
        setError('root', { message: error.detail })
      }

      toast({
        title: 'Customer Portal Settings Update Failed',
        description: `Error updating customer portal settings: ${error.detail}`,
      })

      return
    }

    reset(data.customer_portal_settings)
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
            title="Show metered usage"
            description="Show customer usage in the portal (API endpoints unaffected)"
          >
            <FormField
              control={control}
              name="usage.show"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </SettingsGroupItem>

          <SettingsGroupItem
            title="Enable subscription seat management"
            description="Allow customers to assign and manage seats for their subscriptions."
          >
            <FormField
              control={control}
              name="subscription.update_seats"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </SettingsGroupItem>

          <SettingsGroupItem
            title="Enable subscription plan changes"
            description="Allow customers to change their subscription plan from the portal."
          >
            <FormField
              control={control}
              name="subscription.update_plan"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
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

export default OrganizationCustomerPortalSettings
