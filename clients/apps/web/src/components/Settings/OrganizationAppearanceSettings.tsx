import { useUpdateOrganization } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import { Organization, ResponseError, ValidationError } from '@polar-sh/sdk'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import Button from 'polarkit/components/ui/atoms/button'
import Input from 'polarkit/components/ui/atoms/input'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormMessage,
} from 'polarkit/components/ui/form'
import React from 'react'
import { useForm } from 'react-hook-form'

interface OrganizationAppearanceSettingsProps {
  organization: Organization
}

const OrganizationAppearanceSettings: React.FC<
  OrganizationAppearanceSettingsProps
> = ({ organization }) => {
  const form = useForm<{ name: string; avatar_url: string }>({
    defaultValues: organization,
  })
  const { control, handleSubmit, watch, setError } = form
  const name = watch('name')
  const avatarURL = watch('avatar_url')

  const updateOrganization = useUpdateOrganization()
  const onSubmit = async (body: { name: string; avatar_url: string }) => {
    try {
      await updateOrganization.mutateAsync({
        id: organization.id,
        body,
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
    <Form {...form}>
      <form
        className="dark:divide-polar-700 flex w-full flex-col gap-2"
        onSubmit={handleSubmit(onSubmit)}
      >
        <FormField
          control={control}
          name="name"
          rules={{ required: 'This field is required.' }}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
              <FormDescription>
                Changing the name won&apos;t affect your organization&apos;s
                URL.
              </FormDescription>
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="avatar_url"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between gap-4">
              <FormControl>
                <Input {...field} placeholder="Logo URL" />
              </FormControl>
              <Avatar
                avatar_url={avatarURL}
                name={name}
                className="h-16 w-16"
              />
              <FormMessage />
            </FormItem>
          )}
        />
        <div>
          <Button type="submit" loading={updateOrganization.isPending}>
            Save
          </Button>
        </div>
      </form>
    </Form>
  )
}

export default OrganizationAppearanceSettings
