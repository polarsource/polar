import { useUpdateOrganization } from '@/hooks/queries'
import { useAutoSave } from '@/hooks/useAutoSave'
import { extractApiErrorMessage, setValidationErrors } from '@/utils/api/errors'
import { isValidationError, schemas } from '@polar-sh/client'
import { Switch } from '@polar-sh/orbit'
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
import CustomerPortalCustomUrlSetting from './CustomerPortalCustomUrlSetting'
import { SettingsGroup, SettingsGroupItem } from './SettingsGroup'

interface OrganizationCustomerPortalSettingsProps {
  organization: schemas['Organization']
  readOnly: boolean
}

const OrganizationCustomerPortalSettings: React.FC<
  OrganizationCustomerPortalSettingsProps
> = ({ organization, readOnly }) => {
  const customUrlEnabled =
    organization.feature_settings?.custom_customer_portal_url_enabled ?? false
  const form = useForm<schemas['OrganizationCustomerPortalSettings']>({
    defaultValues: {
      ...organization.customer_portal_settings,
      subscription: {
        pause: false,
        ...organization.customer_portal_settings.subscription,
      },
      customer: {
        allow_email_change: false,
        ...organization.customer_portal_settings.customer,
      },
    },
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
        description: `Error updating customer portal settings: ${extractApiErrorMessage(error)}`,
      })

      return
    }

    reset(data.customer_portal_settings)
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
                      disabled={readOnly}
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
                      disabled={readOnly}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </SettingsGroupItem>

          <SettingsGroupItem
            title="Allow email address changes"
            description="Allow customers to change the email address associated with their account."
          >
            <FormField
              control={control}
              name="customer.allow_email_change"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={readOnly}
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
                      disabled={readOnly}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </SettingsGroupItem>

          <SettingsGroupItem
            title="Enable subscription pausing"
            description="Allow customers to pause and resume their subscriptions from the portal."
          >
            <FormField
              control={control}
              name="subscription.pause"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={readOnly}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </SettingsGroupItem>

          {customUrlEnabled && (
            <FormField
              control={control}
              name="custom_url"
              render={({ field }) => (
                <CustomerPortalCustomUrlSetting
                  organizationId={organization.id}
                  value={field.value ?? null}
                  readOnly={readOnly}
                  onChange={field.onChange}
                />
              )}
            />
          )}
        </SettingsGroup>
      </form>
    </Form>
  )
}

export default OrganizationCustomerPortalSettings
