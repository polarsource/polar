'use client'

import { toast } from '@/components/Toast/use-toast'
import { usePostHog } from '@/hooks/posthog'
import { useOrganization, useUpdateOrganization } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import { getQueryClient } from '@/utils/api/query'
import { isValidationError, schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import { Button } from '@polar-sh/orbit'
import { Input } from '@polar-sh/orbit'
import { Form, FormField, FormMessage } from '@polar-sh/ui/components/ui/form'
import { useForm } from 'react-hook-form'
import { PathCardBanner } from './PathCardBanner'
import { SectionLayout } from './SectionLayout'

interface Props {
  organization: schemas['Organization']
  step: schemas['OrganizationReviewCheck']
  reasonItems: string[]
}

interface FormValues {
  website: string
}

export const ProductUrlSection = ({
  organization: initialOrg,
  step,
  reasonItems,
}: Props) => {
  const { data: organization = initialOrg } = useOrganization(
    initialOrg.id,
    true,
    initialOrg,
    'always',
  )
  const updateOrganization = useUpdateOrganization()
  const posthog = usePostHog()
  const tone = step.status === 'failed' ? 'danger' : 'warning'

  const form = useForm<FormValues>({
    values: { website: organization.website ?? '' },
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
  })
  const { control, handleSubmit, setError, formState, reset } = form

  const onSubmit = async ({ website }: FormValues) => {
    posthog.capture('dashboard:organizations:account_review_section:submit', {
      organization_id: organization.id,
      section: 'product_url',
    })
    const { data, error } = await updateOrganization.mutateAsync({
      id: organization.id,
      body: { website },
    })

    if (error) {
      if (isValidationError(error.detail)) {
        setValidationErrors(error.detail, setError)
      } else {
        toast({
          title: 'Failed to update website',
          description:
            typeof error.detail === 'string'
              ? error.detail
              : 'Please try again.',
        })
      }
      return
    }

    reset({ website: data.website ?? '' })
    getQueryClient().invalidateQueries({
      queryKey: ['organizationReviewState', organization.id],
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <SectionLayout
          description="What's the landing page for this product?"
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
            name="website"
            rules={{
              required: 'Product website is required',
              validate: (value) => {
                if (!value) return 'Product website is required'
                if (!value.startsWith('https://')) {
                  return 'Website must start with https://'
                }
                try {
                  new URL(value)
                  return true
                } catch {
                  return 'Please enter a valid URL'
                }
              },
            }}
            render={({ field }) => (
              <Box display="block">
                <Input
                  type="url"
                  {...field}
                  value={field.value || ''}
                  placeholder="https://acme.com"
                />
                <FormMessage />
              </Box>
            )}
          />
          {reasonItems.map((reason) => (
            <PathCardBanner key={reason} tone={tone} title={reason} />
          ))}
        </SectionLayout>
      </form>
    </Form>
  )
}
