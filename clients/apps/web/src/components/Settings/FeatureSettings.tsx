'use client'

import { useUpdateOrganization } from '@/hooks/queries'
import { useAutoSave } from '@/hooks/useAutoSave'
import { setValidationErrors } from '@/utils/api/errors'
import { isValidationError, schemas } from '@polar-sh/client'
import Switch from '@polar-sh/ui/components/atoms/Switch'
import { Form, FormField } from '@polar-sh/ui/components/ui/form'
import { useForm } from 'react-hook-form'
import { toast } from '../Toast/use-toast'
import { SettingsGroup, SettingsGroupItem } from './SettingsGroup'

export default function FeatureSettings({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const form = useForm<schemas['OrganizationFeatureSettings']>({
    defaultValues: organization.feature_settings || {},
  })
  const { control, setError, reset } = form

  const updateOrganization = useUpdateOrganization()
  const onSave = async (
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
      if (data?.feature_settings) {
        reset(data.feature_settings)
      }
    }
  }

  useAutoSave({
    form,
    onSave,
    delay: 1000,
  })

  return (
    <Form {...form}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
        }}
      >
        <SettingsGroup>
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
        </SettingsGroup>
      </form>
    </Form>
  )
}
