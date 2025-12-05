'use client'

import { OrganizationStep } from '@/components/Onboarding/OrganizationStep'
import { schemas } from '@polar-sh/client'

export interface ClientPageProps {
  slug?: string
  validationErrors?: schemas['ValidationError'][]
  error?: string
  hasExistingOrg: boolean
}

export default function ClientPage({
  slug,
  validationErrors,
  error,
  hasExistingOrg,
}: ClientPageProps) {
  return (
    <OrganizationStep
      slug={slug}
      validationErrors={validationErrors}
      hasExistingOrg={hasExistingOrg}
      error={error}
    />
  )
}
