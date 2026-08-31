'use client'

import { VoidSettingRow, VoidToggle } from '@/components/Void/VoidControls'
import { useUpdateOrganization } from '@/hooks/queries/org'
import { schemas } from '@polar-sh/client'
import { useState } from 'react'
import { SettingsBlock } from './SettingsBlock'

type EmailSettings = schemas['OrganizationCustomerEmailSettings']

const KEYS: (keyof EmailSettings)[] = [
  'order_confirmation',
  'subscription_confirmation',
  'subscription_cycled',
  'subscription_cycled_after_trial',
  'subscription_renewal_reminder',
  'subscription_past_due',
  'subscription_paused',
  'subscription_resumed',
  'subscription_cancellation',
  'payment_method_expiration_reminder',
]

const humanize = (key: string) =>
  key.replace(/_/g, ' ').replace(/^./, (char) => char.toUpperCase())

export const CustomerEmailsBlock = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const updateOrganization = useUpdateOrganization()
  const [settings, setSettings] = useState<EmailSettings>(
    organization.customer_email_settings,
  )

  const save = (next: EmailSettings) => {
    setSettings(next)
    updateOrganization.mutateAsync({
      id: organization.id,
      body: { customer_email_settings: next },
    })
  }

  return (
    <SettingsBlock
      title="Customer notifications"
      description="Emails sent to customers for purchases, renewals and lifecycle events"
    >
      {KEYS.map((key) => (
        <VoidSettingRow key={key} title={humanize(key)}>
          <VoidToggle
            checked={settings[key]}
            onChange={(checked) => save({ ...settings, [key]: checked })}
          />
        </VoidSettingRow>
      ))}
    </SettingsBlock>
  )
}
