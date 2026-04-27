'use client'

import { useOnboardingData } from '@/components/Onboarding/OnboardingContext'
import { useOnboardingV2Tracking } from '@/hooks/onboardingV2'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

export default function Page() {
  const router = useRouter()
  const { data, clearData } = useOnboardingData()
  const { trackCompleted } = useOnboardingV2Tracking()
  const hasTracked = useRef(false)

  useEffect(() => {
    if (hasTracked.current) return
    hasTracked.current = true

    if (data.organizationId) {
      trackCompleted(data.organizationId)
    }

    const slug = data.orgSlug
    clearData()

    router.replace(slug ? `/dashboard/${slug}` : '/dashboard')
  }, [data, clearData, trackCompleted, router])

  return null
}
