'use client'

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
import { useForm } from 'react-hook-form'
import {
  SettingsGroup,
  SettingsGroupActions,
  SettingsGroupItem,
} from './SettingsGroup'

const FeatureSettings = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const form = useForm<schemas['OrganizationFeatureSettings']>({
    defaultValues: organization.feature_settings || {},
  })
  const { control, handleSubmit, setError, formState } = form

  const updateOrganization = useUpdateOrganization()
  const onSubmit = async (
    featureSettings: schemas['OrganizationFeatureSettings'],
  ) => {
    const { error, data } = await updateOrganization.mutateAsync({
      id: organization.id,
      body: {
        feature_settings: featureSettings,
      },
    })

    if (data) {
      form.reset(data.feature_settings ?? {}, {
        keepDirty: false,
      })
    }

    if (error) {
      if (isValidationError(error.detail)) {
        setValidationErrors(error.detail, setError)
      } else {
        setError('root', { message: error.detail })
      }
      return
    }
  }

  return (
    <>
      <Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)} className="w-full">
          <SettingsGroup>
            <SettingsGroupItem
              title="Usage-based Billing & Meter Management"
              description="Manage meters, create usage-based pricing and the units benefit."
            >
              <FormItem>
                <FormControl>
                  <FormField
                    control={control}
                    name="usage_based_billing_enabled"
                    render={({ field }) => {
                      return (
                        <>
                          <Switch
                            id="usage_based_billing_enabled"
                            checked={field.value}
                            onCheckedChange={(enabled) =>
                              field.onChange(enabled)
                            }
                          />
                          <FormMessage />
                        </>
                      )
                    }}
                  />
                </FormControl>
              </FormItem>
            </SettingsGroupItem>
            <SettingsGroupActions>
              <Button
                type="submit"
                loading={updateOrganization.isPending}
                disabled={!formState.isDirty}
                size="sm"
              >
                Save
              </Button>
            </SettingsGroupActions>
          </SettingsGroup>
        </form>
      </Form>
    </>
  )
}

export default FeatureSettings
