'use client'

import { OrganizationStep } from '@/components/Onboarding/OrganizationStep'
import { CONFIG } from '@/utils/config'
import { schemas } from '@polar-sh/client'
import { redirect } from 'next/navigation'

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
  if (!CONFIG.IS_SANDBOX) {
    redirect('/onboarding/start')
  }

  return (
    <OrganizationStep
      slug={slug}
      validationErrors={validationErrors}
      hasExistingOrg={hasExistingOrg}
      error={error}
    />
  )
}
