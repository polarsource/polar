'use client'

import { useAuth } from '@/hooks'
import { useCreateOrganization } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Form } from '@polar-sh/ui/components/ui/form'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useOnboardingData } from './OnboardingContext'
import { OnboardingShell } from './OnboardingShell'
import { OrgNameSlugSync, SandboxFormFields } from './SandboxFormFields'

interface FormSchema {
  orgName: string
  orgSlug: string
  defaultCurrency: string
  terms: boolean
}

function SubmitButton({
  loading,
  error,
}: {
  loading: boolean
  error: string | null
}) {
  const orgName = useWatch<FormSchema, 'orgName'>({ name: 'orgName' })
  const orgSlug = useWatch<FormSchema, 'orgSlug'>({ name: 'orgSlug' })
  const terms = useWatch<FormSchema, 'terms'>({ name: 'terms' })

  return (
    <>
      {error && (
        <p className="text-sm text-red-500 dark:text-red-500">{error}</p>
      )}
      <Button
        type="submit"
        loading={loading}
        disabled={orgName.length === 0 || orgSlug.length === 0 || !terms}
        fullWidth
      >
        Create Sandbox Organization
      </Button>
    </>
  )
}

export function SandboxStep() {
  const router = useRouter()
  const { setUserOrganizations } = useAuth()
  const { clearData } = useOnboardingData()
  const createOrganization = useCreateOrganization()
  const [submitting, setSubmitting] = useState(false)
  const [editingSlug, setEditingSlug] = useState(false)
  const [editedSlug, setEditedSlug] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<FormSchema>({
    defaultValues: {
      orgName: '',
      orgSlug: '',
      defaultCurrency: 'usd',
      terms: false,
    },
  })

  const onSubmit = async (formData: FormSchema) => {
    if (!formData.terms) return
    setSubmitting(true)
    setError(null)

    const { data: org, error: createError } =
      await createOrganization.mutateAsync({
        name: formData.orgName,
        slug: formData.orgSlug,
        default_presentment_currency:
          formData.defaultCurrency as schemas['PresentmentCurrency'],
        default_tax_behavior: 'location',
        legal_entity: { type: 'individual' as const },
      })

    if (createError) {
      const fallbackMessage = 'Failed to create organization. Please try again.'

      let errorMessage = fallbackMessage

      if (Array.isArray(createError?.detail) && createError.detail.length > 0) {
        errorMessage = createError.detail[0]?.msg || fallbackMessage
      } else if (typeof createError?.detail === 'string') {
        errorMessage = createError.detail
      }

      setError(errorMessage)
      setSubmitting(false)
      return
    }

    setUserOrganizations((prev) => [...prev, org])
    router.push(`/dashboard/${org.slug}`)
    clearData()
  }

  return (
    <OnboardingShell
      title="Create a sandbox organization"
      subtitle="Set up a test organization to explore Polar with mock payments."
      apiStep="sandbox"
    >
      <Form {...form}>
        <Box
          as="form"
          onSubmit={form.handleSubmit(onSubmit)}
          display="flex"
          flexDirection="column"
          rowGap="xl"
        >
          <OrgNameSlugSync editedSlug={editedSlug} />
          <SandboxFormFields
            editingSlug={editingSlug}
            setEditingSlug={setEditingSlug}
            onEditSlug={() => setEditedSlug(true)}
            form={form}
          />
          <SubmitButton loading={submitting} error={error} />
        </Box>
      </Form>
    </OnboardingShell>
  )
}
