'use client'

import { OrganizationStep } from '@/components/Onboarding/OrganizationStep'
import { useExperiment } from '@/experiments/client'
import { schemas } from '@polar-sh/client'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

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
  const { isTreatment } = useExperiment('onboarding_v2')
  const router = useRouter()

  useEffect(() => {
    if (isTreatment) {
      router.replace('/onboarding/start')
    }
  }, [isTreatment, router])

  if (isTreatment) {
    return null
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
