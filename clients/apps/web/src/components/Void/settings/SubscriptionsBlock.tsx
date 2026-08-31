'use client'

import {
  VoidField,
  VoidSelect,
  VoidSettingRow,
  VoidToggle,
} from '@/components/Void/VoidControls'
import { useUpdateOrganization } from '@/hooks/queries/org'
import { schemas } from '@polar-sh/client'
import { useState } from 'react'
import { SettingsBlock } from './SettingsBlock'

export const SubscriptionsBlock = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const updateOrganization = useUpdateOrganization()
  const [settings, setSettings] = useState<
    schemas['OrganizationSubscriptionSettings']
  >(organization.subscription_settings)

  const save = (next: schemas['OrganizationSubscriptionSettings']) => {
    setSettings(next)
    updateOrganization.mutateAsync({
      id: organization.id,
      body: { subscription_settings: next },
    })
  }

  return (
    <SettingsBlock title="Subscriptions">
      <VoidSettingRow
        title="Multiple subscriptions"
        description="Allow customers to hold several subscriptions at once"
      >
        <VoidToggle
          checked={settings.allow_multiple_subscriptions}
          onChange={(allow_multiple_subscriptions) =>
            save({ ...settings, allow_multiple_subscriptions })
          }
        />
      </VoidSettingRow>
      <VoidSettingRow
        title="Proration"
        description="How customers are billed when they change plan"
      >
        <VoidSelect
          value={settings.proration_behavior}
          options={[
            { value: 'invoice', label: 'Invoice immediately' },
            { value: 'prorate', label: 'Prorate on next invoice' },
            { value: 'next_period', label: 'Apply next period' },
          ]}
          onChange={(value) =>
            save({
              ...settings,
              proration_behavior: value as
                | 'invoice'
                | 'prorate'
                | 'next_period',
            })
          }
        />
      </VoidSettingRow>
      <VoidSettingRow
        title="Benefit revocation grace period"
        description="Days to wait before revoking benefits during payment retries"
      >
        <VoidField
          type="number"
          width={96}
          value={`${settings.benefit_revocation_grace_period}`}
          onCommit={(value) =>
            save({
              ...settings,
              benefit_revocation_grace_period: Math.max(Number(value) || 0, 0),
            })
          }
        />
      </VoidSettingRow>
      <VoidSettingRow
        title="Prevent trial abuse"
        description="Customers who already had a trial are not eligible for another"
      >
        <VoidToggle
          checked={settings.prevent_trial_abuse}
          onChange={(prevent_trial_abuse) =>
            save({ ...settings, prevent_trial_abuse })
          }
        />
      </VoidSettingRow>
    </SettingsBlock>
  )
}
