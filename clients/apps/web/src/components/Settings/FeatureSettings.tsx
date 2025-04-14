'use client'

import { useUpdateOrganization } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import { isValidationError, schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import ShadowListGroup from '@polar-sh/ui/components/atoms/ShadowListGroup'
import Switch from '@polar-sh/ui/components/atoms/Switch'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { useForm } from 'react-hook-form'

const FeatureSettings = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const form = useForm<schemas['OrganizationFeatureSettings']>({
    defaultValues: organization.feature_settings || {},
  })
  const { control, handleSubmit, setError } = form

  const updateOrganization = useUpdateOrganization()
  const onSubmit = async (
    featureSettings: schemas['OrganizationFeatureSettings'],
  ) => {
    const { error } = await updateOrganization.mutateAsync({
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
      return
    }
  }

  return (
    <>
      <Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)} className="w-full">
          <ShadowListGroup>
            <div className="dark:divide-polar-700 flex w-full flex-col">
              <ShadowListGroup.Item>
                <FormItem>
                  <FormControl>
                    <div className="flex flex-row items-center text-sm">
                      <div className="grow">
                        <FormLabel htmlFor="usage_based_billing_enabled">
                          Usage-based billing and meter management
                        </FormLabel>
                        <p className="text-gray-500">
                          Enable usage-based billing for your organization. This
                          will allow you to manage meters, create usage-based
                          pricing and the units benefit.
                        </p>
                        <p className="mt-2 font-semibold text-yellow-500">
                          This feature is in alpha and subject to changes.
                        </p>
                      </div>
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
                    </div>
                  </FormControl>
                </FormItem>
              </ShadowListGroup.Item>
            </div>
          </ShadowListGroup>
          <Button
            type="submit"
            loading={updateOrganization.isPending}
            className="mt-8"
          >
            Save
          </Button>
        </form>
      </Form>
    </>
  )
}

export default FeatureSettings
