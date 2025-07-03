import { useUpdateOrganization } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import { isValidationError, schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
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
import {
  SettingsGroup,
  SettingsGroupActions,
  SettingsGroupItem,
} from './SettingsGroup'

interface OrganizationNotificationSettingsProps {
  organization: schemas['Organization']
}

const OrganizationNotificationSettings: React.FC<
  OrganizationNotificationSettingsProps
> = ({ organization }) => {
  const form = useForm<schemas['OrganizationNotificationSettings']>({
    defaultValues: organization.notification_settings,
  })
  const { control, handleSubmit, setError, reset, formState } = form

  const updateOrganization = useUpdateOrganization()
  const onSubmit = async (
    notification_settings: schemas['OrganizationNotificationSettings'],
  ) => {
    const { data, error } = await updateOrganization.mutateAsync({
      id: organization.id,
      body: {
        notification_settings,
      },
    })

    if (error) {
      if (isValidationError(error.detail)) {
        setValidationErrors(error.detail, setError)
      } else {
        setError('root', { message: error.detail })
      }
      return
    }

    reset(data.notification_settings)

    toast({
      title: 'Notification Settings Updated',
      description: `Notifications settings were updated successfully`,
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <SettingsGroup>
          <SettingsGroupItem
            title="New Orders"
            description="Send a notification when new orders are created"
          >
            <FormField
              control={control}
              name="new_order"
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

          <SettingsGroupItem
            title="New Subscriptions"
            description="Send a notification when new subscriptions are created"
          >
            <FormField
              control={control}
              name="new_subscription"
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

          <SettingsGroupActions>
            <Button
              className="self-start"
              type="submit"
              size="sm"
              disabled={!formState.isDirty}
              loading={updateOrganization.isPending}
            >
              Save
            </Button>
          </SettingsGroupActions>
        </SettingsGroup>
      </form>
    </Form>
  )
}

export default OrganizationNotificationSettings
