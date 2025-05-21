'use client'

import OrganizationStep from '@/components/Onboarding/OrganizationStep'
import { schemas } from '@polar-sh/client'

export interface ClientPageProps {
  slug?: string
  validationErrors?: schemas['ValidationError'][]
  error?: string
}

export default function ClientPage({
  slug,
  validationErrors,
  error,
}: ClientPageProps) {
  return (
    <OrganizationStep
      slug={slug}
      validationErrors={validationErrors}
      error={error}
    />
  )
}
