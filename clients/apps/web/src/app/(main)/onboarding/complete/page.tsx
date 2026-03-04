'use client'

import { useOnboardingData } from '@/components/Onboarding/v2/OnboardingContext'
import { useOnboardingTracking } from '@/hooks'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

export default function Page() {
  const router = useRouter()
  const { data, clearData } = useOnboardingData()
  const { trackCompleted } = useOnboardingTracking()
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
