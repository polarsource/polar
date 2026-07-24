import { useUpdateOrganization } from '@/hooks/queries'
import { useOptimisticSave } from '@/hooks/useOptimisticSave'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { schemas } from '@polar-sh/client'
import { Switch } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import React from 'react'
import { toast } from '../Toast/use-toast'
import CustomerEmailLinkSetting from './CustomerEmailLinkSetting'
import { SettingsGroup, SettingsGroupItem } from './SettingsGroup'

interface OrganizationCustomerEmailSettingsProps {
  organization: schemas['Organization']
  readOnly: boolean
}

const customerEmails: {
  key: Exclude<keyof schemas['OrganizationCustomerEmailSettings'], 'link_url'>
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
  {
    key: 'subscription_paused',
    title: 'Subscription paused',
    description: 'Sent when a customer pauses their subscription',
  },
  {
    key: 'subscription_resumed',
    title: 'Subscription resumed',
    description: 'Sent when a paused subscription resumes and billing restarts',
  },
]

const OrganizationCustomerEmailSettings: React.FC<
  OrganizationCustomerEmailSettingsProps
> = ({ organization, readOnly }) => {
  const customLinkEnabled =
    organization.feature_settings?.custom_email_link_enabled ?? false
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
    <Box flexDirection="column" rowGap="l" width="100%">
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
      {customLinkEnabled && (
        <CustomerEmailLinkSetting
          value={settings.link_url ?? null}
          readOnly={readOnly}
          onChange={(link_url) =>
            update((previous) => ({ ...previous, link_url }))
          }
        />
      )}
    </Box>
  )
}

export default OrganizationCustomerEmailSettings
