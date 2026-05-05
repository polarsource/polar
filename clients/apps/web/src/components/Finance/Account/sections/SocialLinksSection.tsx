'use client'

import { SocialLinksField } from '@/components/Organization/forms/SocialLinksField'
import { toast } from '@/components/Toast/use-toast'
import { useUpdateOrganization } from '@/hooks/queries'
import { getQueryClient } from '@/utils/api/query'
import { setValidationErrors } from '@/utils/api/errors'
import { isValidationError, schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Form } from '@polar-sh/ui/components/ui/form'
import { useForm } from 'react-hook-form'

interface Props {
  organization: schemas['Organization']
}

type FormValues = Pick<schemas['OrganizationUpdate'], 'socials'>

export const SocialLinksSection = ({ organization }: Props) => {
  const updateOrganization = useUpdateOrganization()
  const form = useForm<FormValues>({
    defaultValues: { socials: organization.socials ?? [] },
  })
  const { handleSubmit, setError, formState, reset } = form

  const onSubmit = async ({ socials }: FormValues) => {
    const cleaned = (socials ?? []).filter(
      (social) => social.url && social.url.trim() !== '',
    )

    const { data, error } = await updateOrganization.mutateAsync({
      id: organization.id,
      body: { socials: cleaned },
    })

    if (error) {
      if (isValidationError(error.detail)) {
        setValidationErrors(error.detail, setError)
      } else {
        toast({
          title: 'Failed to update social links',
          description:
            typeof error.detail === 'string'
              ? error.detail
              : 'Please try again.',
        })
      }
      return
    }

    reset({ socials: data.socials ?? [] })
    getQueryClient().invalidateQueries({
      queryKey: ['organizationReviewState', organization.id],
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-y-3">
        <SocialLinksField required />
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
