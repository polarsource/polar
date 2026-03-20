'use client'

import { OrganizationStep } from '@/components/Onboarding/OrganizationStep'
import { useExperiment } from '@/experiments/client'
import { CONFIG } from '@/utils/config'
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

  const useNewOnboarding = isTreatment && !CONFIG.IS_SANDBOX

  useEffect(() => {
    if (useNewOnboarding) {
      router.replace('/onboarding/start')
    }
  }, [useNewOnboarding, router])

  if (useNewOnboarding) {
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
