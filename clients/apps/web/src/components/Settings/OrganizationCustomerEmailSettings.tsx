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

interface OrganizationCustomerEmailSettingsProps {
  organization: schemas['Organization']
}

const customerEmails: {
  key: keyof schemas['OrganizationCustomerEmailSettings']
  title: string
  description: string
}[] = [
  {
    key: 'order_confirmation',
    title: 'Order confirmation',
    description: 'Sent when a customer completes a one-time purchase',
  },
  {
    key: 'subscription_confirmation',
    title: 'Subscription confirmation',
    description: 'Sent when a customer starts a new subscription',
  },
  {
    key: 'subscription_cycled',
    title: 'Subscription cycled',
    description: 'Sent when a subscription automatically renews',
  },
  {
    key: 'subscription_updated',
    title: 'Subscription updated',
    description:
      'Sent when a customer changes their subscription to a different product',
  },
  {
    key: 'subscription_cancellation',
    title: 'Subscription canceled',
    description: 'Sent when a customer cancels their subscription',
  },
  {
    key: 'subscription_uncanceled',
    title: 'Subscription uncanceled',
    description:
      'Sent when a customer reactivates a previously canceled subscription',
  },
  {
    key: 'subscription_revoked',
    title: 'Subscription revoked',
    description:
      'Sent when a canceled subscription permanently ends at the end of the billing cycle',
  },
  {
    key: 'subscription_past_due',
    title: 'Subscription past due',
    description: 'Sent when a subscription payment fails and becomes overdue',
  },
]

const OrganizationCustomerEmailSettings: React.FC<
  OrganizationCustomerEmailSettingsProps
> = ({ organization }) => {
  const form = useForm<schemas['OrganizationCustomerEmailSettings']>({
    defaultValues: organization.customer_email_settings,
  })
  const { control, setError, reset } = form

  const updateOrganization = useUpdateOrganization()
  const onSave = async (
    customer_email_settings: schemas['OrganizationCustomerEmailSettings'],
  ) => {
    const { data, error } = await updateOrganization.mutateAsync({
      id: organization.id,
      body: {
        customer_email_settings,
      },
    })

    if (error) {
      if (isValidationError(error.detail)) {
        setValidationErrors(error.detail, setError)
      } else {
        setError('root', { message: error.detail })
      }

      toast({
        title: 'Customer Email Settings Update Failed',
        description: `Error updating customer email settings: ${error.detail}`,
      })

      return
    }

    reset(data.customer_email_settings)
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
          {customerEmails.map(({ key, title, description }) => (
            <SettingsGroupItem
              key={key}
              title={title}
              description={description}
            >
              <FormField
                control={control}
                name={key}
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
          ))}
        </SettingsGroup>
      </form>
    </Form>
  )
}

export default OrganizationCustomerEmailSettings
