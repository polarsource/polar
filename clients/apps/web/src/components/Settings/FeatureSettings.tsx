'use client'

import {
  ShadowListGroup,
} from 'polarkit/components/ui/atoms'
import { Switch } from 'polarkit/components/ui/atoms'
import Button from 'polarkit/components/ui/atoms/button'
import {
  Organization,
  ResponseError,
  ValidationError,
} from '@polar-sh/sdk'
import { useUpdateOrganization } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from 'polarkit/components/ui/form'
import { useForm } from 'react-hook-form'

interface Features {
  donations: boolean
  issues: boolean
}

const FeatureSettings = ({
  organization,
}: {
  organization: Organization
}) => {
  const form = useForm<Features>({
    defaultValues: {
      donations: organization.donations_enabled,
      issues: organization.feature_settings?.issue_funding_enabled
    },
  })
  const { control, handleSubmit, watch, setError, setValue } = form
  const donationsEnabled = watch('donations')
  const issuesEnabled = watch('issues')

  const updateOrganization = useUpdateOrganization()
  const onSubmit = async (body: Features) => {
    try {
      await updateOrganization.mutateAsync({
        id: organization.id,
        body: {
          donations_enabled: body.donations,
          feature_settings: {
            ...organization.feature_settings,
            issue_funding_enabled: body.issues
          }
        }
      })
    } catch (e) {
      if (e instanceof ResponseError) {
        const body = await e.response.json()
        if (e.response.status === 422) {
          const validationErrors = body['detail'] as ValidationError[]
          setValidationErrors(validationErrors, setError)
        } else {
          setError('root', { message: e.message })
        }
      }
    }
  }

  return (
    <>
      <Form {...form}>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="w-full"
        >
        <ShadowListGroup>
          <div className="dark:divide-polar-700 flex w-full flex-col">
            <ShadowListGroup.Item>
              <FormItem>
                <FormControl>
                  <div className="flex flex-row items-center text-sm">
                    <div className="grow">
                      <FormLabel htmlFor="issues">GitHub Issue Funding</FormLabel>
                      <p className="text-gray-500">Funding &amp; contributor rewards for GitHub issues.</p>
                    </div>
                    <FormField
                      control={control}
                      name="issues"
                      render={() => {
                        return (
                          <>
                            <Switch
                              id="issues"
                              checked={issuesEnabled}
                              onCheckedChange={(enabled) => {
                                setValue('issues', enabled)
                              }}
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

            <ShadowListGroup.Item>
              <FormItem>
                <FormControl>
                  <div className="flex flex-row items-center text-sm">
                    <div className="grow">
                      <FormLabel htmlFor="donations">Donations</FormLabel>
                      <p className="text-gray-500">Use products with pay what you want pricing instead. Donations will soon be migrated.</p>
                    </div>
                    <FormField
                      control={control}
                      name="donations"
                      render={() => {
                        return (
                          <>
                            <Switch
                              id="donations"
                              checked={donationsEnabled}
                              onCheckedChange={(enabled) => {
                                setValue('donations', enabled)
                              }}
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
        <Button type="submit" loading={updateOrganization.isPending} className="mt-8">
          Save
        </Button>
      </form>
    </Form>
    </>
  )
}

export default FeatureSettings
