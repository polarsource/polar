import { useHasPermission } from '@/hooks/permissions'
import { useOptimisticSave } from '@/hooks/useOptimisticSave'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { schemas } from '@polar-sh/client'
import { Switch } from '@polar-sh/orbit'
import React from 'react'
import { toast } from '../Toast/use-toast'
import { SettingsGroup, SettingsGroupItem } from './SettingsGroup'
import { useUpdateUserOrganizationNotificationSettings } from '@/hooks/queries/user_organizations'

interface OrganizationNotificationSettingsProps {
  organization: schemas['Organization']
  userNotificationSettings: schemas['UserOrganizationNotificationSettings']
}

const OrganizationNotificationSettings: React.FC<
  OrganizationNotificationSettingsProps
> = ({ organization, userNotificationSettings }) => {
  const updateUserOrganizationNotificationSettings =
    useUpdateUserOrganizationNotificationSettings(organization.id)

  const canManage = useHasPermission(organization.id, 'organization:manage')

  const { value: settings, update } = useOptimisticSave(
    userNotificationSettings.notification_settings,
    async (notification_settings) => {
      const { error } =
        await updateUserOrganizationNotificationSettings.mutateAsync({
          notification_settings,
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
        layout="inline"
        title="New One-Time Purchases"
        description="Receive a notification when a one-time purchase is made"
      >
        <Switch
          checked={settings.new_order}
          onCheckedChange={(checked) =>
            update((previous) => ({ ...previous, new_order: checked }))
          }
        />
      </SettingsGroupItem>

      <SettingsGroupItem
        layout="inline"
        title="New Subscriptions"
        description="Receive a notification when new subscriptions are created"
      >
        <Switch
          checked={settings.new_subscription}
          onCheckedChange={(checked) =>
            update((previous) => ({ ...previous, new_subscription: checked }))
          }
        />
      </SettingsGroupItem>

      <SettingsGroupItem
        layout="inline"
        title="Subscription Renewals"
        description="Receive a notification each time a subscription renewal payment is collected"
      >
        <Switch
          checked={settings.subscription_renewal ?? false}
          onCheckedChange={(checked) =>
            update((previous) => ({
              ...previous,
              subscription_renewal: checked,
            }))
          }
        />
      </SettingsGroupItem>

      {canManage === true && (
        <SettingsGroupItem
          layout="inline"
          title="Prevented Chargebacks"
          description="Receive a notification when a refund is issued to prevent a chargeback"
        >
          <Switch
            checked={settings.chargeback_prevention}
            onCheckedChange={(checked) =>
              update((previous) => ({
                ...previous,
                chargeback_prevention: checked,
              }))
            }
          />
        </SettingsGroupItem>
      )}
    </SettingsGroup>
  )
}

export default OrganizationNotificationSettings
