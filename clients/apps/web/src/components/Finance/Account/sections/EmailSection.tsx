'use client'

import { useUpdateOrganization } from '@/hooks/queries'
import { getQueryClient } from '@/utils/api/query'
import { setValidationErrors } from '@/utils/api/errors'
import { isValidationError, schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import { Form, FormField, FormMessage } from '@polar-sh/ui/components/ui/form'
import { useForm } from 'react-hook-form'
import { toast } from '@/components/Toast/use-toast'

interface Props {
  organization: schemas['Organization']
}

interface FormValues {
  email: string
}

export const EmailSection = ({ organization }: Props) => {
  const updateOrganization = useUpdateOrganization()
  const form = useForm<FormValues>({
    defaultValues: { email: organization.email ?? '' },
  })
  const { control, handleSubmit, setError, formState, reset } = form

  const onSubmit = async ({ email }: FormValues) => {
    const { data, error } = await updateOrganization.mutateAsync({
      id: organization.id,
      body: { email },
    })

    if (error) {
      if (isValidationError(error.detail)) {
        setValidationErrors(error.detail, setError)
      } else {
        toast({
          title: 'Failed to update email',
          description:
            typeof error.detail === 'string'
              ? error.detail
              : 'Please try again.',
        })
      }
      return
    }

    reset({ email: data.email ?? '' })
    getQueryClient().invalidateQueries({
      queryKey: ['organizationReviewState', organization.id],
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-y-3">
        <FormField
          control={control}
          name="email"
          rules={{ required: 'Support email is required' }}
          render={({ field }) => (
            <div>
              <Input type="email" {...field} placeholder="support@acme.com" />
              <FormMessage />
            </div>
          )}
        />
        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            loading={updateOrganization.isPending}
            disabled={!formState.isDirty || updateOrganization.isPending}
          >
            Save
          </Button>
        </div>
      </form>
    </Form>
  )
}
