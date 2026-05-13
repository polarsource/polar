'use client'

import { SocialLinksField } from './SocialLinksField'
import { toast } from '@/components/Toast/use-toast'
import { usePostHog } from '@/hooks/posthog'
import { useOrganization, useUpdateOrganization } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import { getQueryClient } from '@/utils/api/query'
import { isValidationError, schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Form } from '@polar-sh/ui/components/ui/form'
import { useForm } from 'react-hook-form'
import { SectionLayout } from './SectionLayout'

interface Props {
  organization: schemas['Organization']
}

type FormValues = Pick<schemas['OrganizationUpdate'], 'socials'>

export const SocialLinksSection = ({ organization: initialOrg }: Props) => {
  const { data: organization = initialOrg } = useOrganization(
    initialOrg.id,
    true,
    initialOrg,
    'always',
  )
  const updateOrganization = useUpdateOrganization()
  const posthog = usePostHog()
  const form = useForm<FormValues>({
    values: { socials: organization.socials ?? [] },
  })
  const { handleSubmit, setError, formState, reset } = form

  const onSubmit = async ({ socials }: FormValues) => {
    posthog.capture('dashboard:organizations:account_review_section:submit', {
      organization_id: organization.id,
      section: 'social_links',
    })
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
      <form onSubmit={handleSubmit(onSubmit)}>
        <SectionLayout
          description="Link your public profiles. We use them to verify your organization."
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
          <SocialLinksField required />
        </SectionLayout>
      </form>
    </Form>
  )
}
