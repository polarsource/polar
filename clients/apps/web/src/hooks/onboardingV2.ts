'use client'

import { usePostHog } from '@/hooks/posthog'
import { useCallback, useRef } from 'react'

export type OnboardingV2Step = 'personal' | 'business' | 'product'

export interface UseOnboardingV2TrackingReturn {
  trackStepViewed: (step: OnboardingV2Step) => void
  trackStepCompleted: (
    step: OnboardingV2Step,
    properties?: Record<string, string | number | boolean | null | undefined>,
  ) => void
  trackCompleted: (organizationId: string) => void
}

export const useOnboardingV2Tracking = (): UseOnboardingV2TrackingReturn => {
  const posthog = usePostHog()
  const viewedSteps = useRef(new Set<string>())

  const trackStepViewed = useCallback(
    (step: OnboardingV2Step) => {
      if (viewedSteps.current.has(step)) return
      viewedSteps.current.add(step)

      posthog.capture('dashboard:onboarding:step:view', {
        step,
        mode: 'production',
      })
    },
    [posthog],
  )

  const trackStepCompleted = useCallback(
    (
      step: OnboardingV2Step,
      properties?: Record<string, string | number | boolean | null | undefined>,
    ) => {
      posthog.capture('dashboard:onboarding:step:complete', {
        step,
        mode: 'production',
        ...properties,
      })
    },
    [posthog],
  )

  const trackCompleted = useCallback(
    (organizationId: string) => {
      posthog.capture('dashboard:onboarding:flow:complete', {
        organization_id: organizationId,
        mode: 'production',
      })
    },
    [posthog],
  )

  return { trackStepViewed, trackStepCompleted, trackCompleted }
}
