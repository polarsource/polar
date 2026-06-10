import { useUpdateOrganization } from '@/hooks/queries'
import { useOptimisticSave } from '@/hooks/useOptimisticSave'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { schemas } from '@polar-sh/client'
import { Switch } from '@polar-sh/orbit'
import React from 'react'
import { toast } from '../Toast/use-toast'
import { SettingsGroup, SettingsGroupItem } from './SettingsGroup'

interface OrganizationCustomerEmailSettingsProps {
  organization: schemas['Organization']
  readOnly: boolean
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
    key: 'subscription_cycled_after_trial',
    title: 'Trial converted',
    description: 'Sent when a trial ends and the subscription becomes paid',
  },
  {
    key: 'subscription_renewal_reminder',
    title: 'Renewal reminder',
    description:
      'Sent 7 days before a subscription with a long billing cycle renews',
  },
  {
    key: 'subscription_trial_conversion_reminder',
    title: 'Trial conversion reminder',
    description: 'Sent before a trial ends and converts to a paid subscription',
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
> = ({ organization, readOnly }) => {
  const updateOrganization = useUpdateOrganization()

  const { value: settings, update } = useOptimisticSave(
    organization.customer_email_settings,
    async (customer_email_settings) => {
      const { error } = await updateOrganization.mutateAsync({
        id: organization.id,
        body: { customer_email_settings },
      })

      if (error) {
        toast({
          title: 'Customer Email Settings Update Failed',
          description: `Error updating customer email settings: ${extractApiErrorMessage(error)}`,
        })
        return false
      }

      return true
    },
  )

  return (
    <SettingsGroup>
      {customerEmails.map(({ key, title, description }) => (
        <SettingsGroupItem key={key} title={title} description={description}>
          <Switch
            checked={settings[key]}
            disabled={readOnly}
            onCheckedChange={(checked) =>
              update((previous) => ({ ...previous, [key]: checked }))
            }
          />
        </SettingsGroupItem>
      ))}
    </SettingsGroup>
  )
}

export default OrganizationCustomerEmailSettings
