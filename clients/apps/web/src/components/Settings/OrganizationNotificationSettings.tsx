import { useUpdateOrganization } from '@/hooks/queries'
import { useOptimisticSave } from '@/hooks/useOptimisticSave'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { schemas } from '@polar-sh/client'
import Switch from '@polar-sh/ui/components/atoms/Switch'
import React from 'react'
import { toast } from '../Toast/use-toast'
import { SettingsGroup, SettingsGroupItem } from './SettingsGroup'

interface OrganizationNotificationSettingsProps {
  organization: schemas['Organization']
}

const OrganizationNotificationSettings: React.FC<
  OrganizationNotificationSettingsProps
> = ({ organization }) => {
  const updateOrganization = useUpdateOrganization()

  const { value: settings, update } = useOptimisticSave(
    organization.notification_settings,
    async (notification_settings) => {
      const { error } = await updateOrganization.mutateAsync({
        id: organization.id,
        body: { notification_settings },
      })

      if (error) {
        toast({
          title: 'Notification Settings Update Failed',
          description: `Error updating notification settings: ${extractApiErrorMessage(error)}`,
        })
        return false
      }

      return true
    },
  )

  return (
    <SettingsGroup>
      <SettingsGroupItem
        title="New Orders"
        description="Send a notification when new orders are created"
      >
        <Switch
          checked={settings.new_order}
          onCheckedChange={(checked) =>
            update((previous) => ({ ...previous, new_order: checked }))
          }
        />
      </SettingsGroupItem>

      <SettingsGroupItem
        title="New Subscriptions"
        description="Send a notification when new subscriptions are created"
      >
        <Switch
          checked={settings.new_subscription}
          onCheckedChange={(checked) =>
            update((previous) => ({ ...previous, new_subscription: checked }))
          }
        />
      </SettingsGroupItem>
    </SettingsGroup>
  )
}

export default OrganizationNotificationSettings
