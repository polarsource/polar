'use client'

import { VoidSettingRow, VoidToggle } from '@/components/Void/VoidControls'
import { useUpdateOrganization } from '@/hooks/queries/org'
import { schemas } from '@polar-sh/client'
import { useState } from 'react'
import { SettingsBlock } from './SettingsBlock'

type PortalSettings = schemas['OrganizationCustomerPortalSettings']

export const PortalBlock = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const updateOrganization = useUpdateOrganization()
  const [settings, setSettings] = useState<PortalSettings>(
    organization.customer_portal_settings,
  )

  const save = (next: PortalSettings) => {
    setSettings(next)
    updateOrganization.mutateAsync({
      id: organization.id,
      body: { customer_portal_settings: next },
    })
  }

  return (
    <SettingsBlock
      title="Customer portal"
      description="What customers can see and do in their portal"
    >
      <VoidSettingRow title="Show usage">
        <VoidToggle
          checked={settings.usage.show}
          onChange={(show) =>
            save({ ...settings, usage: { ...settings.usage, show } })
          }
        />
      </VoidSettingRow>
      <VoidSettingRow title="Update plan">
        <VoidToggle
          checked={settings.subscription.update_plan ?? false}
          onChange={(update_plan) =>
            save({
              ...settings,
              subscription: { ...settings.subscription, update_plan },
            })
          }
        />
      </VoidSettingRow>
      <VoidSettingRow title="Update seats">
        <VoidToggle
          checked={settings.subscription.update_seats}
          onChange={(update_seats) =>
            save({
              ...settings,
              subscription: { ...settings.subscription, update_seats },
            })
          }
        />
      </VoidSettingRow>
      <VoidSettingRow title="Pause subscription">
        <VoidToggle
          checked={settings.subscription.pause ?? false}
          onChange={(pause) =>
            save({
              ...settings,
              subscription: { ...settings.subscription, pause },
            })
          }
        />
      </VoidSettingRow>
      <VoidSettingRow title="Allow email change">
        <VoidToggle
          checked={settings.customer?.allow_email_change ?? false}
          onChange={(allow_email_change) =>
            save({
              ...settings,
              customer: { ...settings.customer, allow_email_change },
            })
          }
        />
      </VoidSettingRow>
    </SettingsBlock>
  )
}
