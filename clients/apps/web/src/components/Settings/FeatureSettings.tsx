'use client'

import { useUpdateOrganization } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import { isValidationError, schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Switch from '@polar-sh/ui/components/atoms/Switch'
import { Form, FormField } from '@polar-sh/ui/components/ui/form'
import { useForm } from 'react-hook-form'
import { toast } from '../Toast/use-toast'
import {
  SettingsGroup,
  SettingsGroupActions,
  SettingsGroupItem,
} from './SettingsGroup'

export default function FeatureSettings({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const form = useForm<schemas['OrganizationFeatureSettings']>({
    defaultValues: organization.feature_settings || {},
  })
  const { control, handleSubmit, setError, formState, reset } = form

  const updateOrganization = useUpdateOrganization()
  const onSubmit = async (
    featureSettings: schemas['OrganizationFeatureSettings'],
  ) => {
    const { data, error } = await updateOrganization.mutateAsync({
      id: organization.id,
      body: {
        feature_settings: featureSettings,
      },
    })

    if (error) {
      if (isValidationError(error.detail)) {
        setValidationErrors(error.detail, setError)
      } else {
        setError('root', { message: error.detail })
      }

      toast({
        title: 'Feature Settings Update Failed',
        description: `Error updating feature settings: ${error.detail}`,
      })
      return
    } else {
      toast({
        title: 'Feature Settings Updated',
        description: `Feature settings were updated successfully`,
      })

      if (data?.feature_settings) {
        reset(data.feature_settings)
      }
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <SettingsGroup>
          <SettingsGroupItem
            title="Seat-based Billing Beta"
            description="Create seat-based products & allow customers to manage the seats."
          >
            <FormField
              control={control}
              name="seat_based_pricing_enabled"
              render={({ field }) => {
                return (
                  <>
                    <Switch
                      checked={field.value}
                      onCheckedChange={(enabled) => field.onChange(enabled)}
                    />
                  </>
                )
              }}
            />
          </SettingsGroupItem>
          <SettingsGroupItem
            title="Cost Insights"
            description="Experimental feature to track costs and profits."
          >
            <FormField
              control={control}
              name="revops_enabled"
              render={({ field }) => {
                return (
                  <>
                    <Switch
                      checked={field.value}
                      onCheckedChange={(enabled) => field.onChange(enabled)}
                    />
                  </>
                )
              }}
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
