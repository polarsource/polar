'use client'

import { VoidSettingRow, VoidToggle } from '@/components/Void/VoidControls'
import {
  useUpdateUserOrganizationNotificationSettings,
  useUserOrganizationNotificationSettings,
} from '@/hooks/queries/user_organizations'
import { schemas } from '@polar-sh/client'
import { SettingsBlock } from './SettingsBlock'

const LABELS: Record<string, string> = {
  new_order: 'New orders',
  new_subscription: 'New subscriptions',
  chargeback_prevention: 'Chargeback prevention',
}

export const UserNotificationsBlock = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const { data: settings } = useUserOrganizationNotificationSettings(
    organization.id,
  )
  const update = useUpdateUserOrganizationNotificationSettings(organization.id)

  if (!settings) return null

  return (
    <SettingsBlock
      title="Your notifications"
      description="Emails you receive as a member of this organization"
    >
      {Object.keys(LABELS).map((key) => (
        <VoidSettingRow key={key} title={LABELS[key]}>
          <VoidToggle
            checked={Boolean(settings[key as keyof typeof settings])}
            onChange={(checked) =>
              update.mutateAsync({ ...settings, [key]: checked })
            }
          />
        </VoidSettingRow>
      ))}
    </SettingsBlock>
  )
}
