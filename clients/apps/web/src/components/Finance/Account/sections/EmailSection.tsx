'use client'

import { toast } from '@/components/Toast/use-toast'
import { useUpdateOrganization } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import { getQueryClient } from '@/utils/api/query'
import { isValidationError, schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import { Form, FormField, FormMessage } from '@polar-sh/ui/components/ui/form'
import { useForm } from 'react-hook-form'
import { SectionLayout } from './SectionLayout'

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
      <form onSubmit={handleSubmit(onSubmit)}>
        <SectionLayout
          description="The email customers and Polar can use to reach you. Use a business email tied to your organization domain."
          footerEnd={
            <Button
              type="submit"
              size="sm"
              loading={updateOrganization.isPending}
              disabled={!formState.isDirty || updateOrganization.isPending}
            >
              Save
            </Button>
          }
        >
          <FormField
            control={control}
            name="email"
            rules={{ required: 'Support email is required' }}
            render={({ field }) => (
              <Box>
                <Input type="email" {...field} placeholder="support@acme.com" />
                <FormMessage />
              </Box>
            )}
          />
        </SectionLayout>
      </form>
    </Form>
  )
}
