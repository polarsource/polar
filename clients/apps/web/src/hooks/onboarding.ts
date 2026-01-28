'use client'

import { useExperiment } from '@/experiments/client'
import { schemas } from '@polar-sh/client'
import { usePostHog } from 'posthog-js/react'
import { useCallback, useMemo } from 'react'

const ONBOARDING_COOKIE_NAME = 'polar_onboarding_session'
const SESSION_TIMEOUT_HOURS = 24

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL

export type OnboardingStep = 'org' | 'product' | 'integrate'
export type SignupMethod = 'github' | 'google' | 'email'

export const inferSignupMethod = (
  oauthAccounts?: schemas['OAuthAccountRead'][],
): SignupMethod => {
  if (!oauthAccounts || oauthAccounts.length === 0) {
    return 'email'
  }


  if (oauthAccounts.some((account) => account.platform === 'github')) {
    return 'github'
  }


  if (oauthAccounts.some((account) => account.platform === 'google')) {
    return 'google'
  }


  return 'email'
}

export interface OnboardingSessionState {
  session_id: string
  started_at: string
  current_step: OnboardingStep
  steps_completed: number
  signup_method: SignupMethod
  experiment_name?: string | null
  experiment_variant?: string | null
}

const getOnboardingSession = (): OnboardingSessionState | null => {
  if (typeof document === 'undefined') return null

  const cookieValue = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${ONBOARDING_COOKIE_NAME}=`))
    ?.split('=')[1]

  if (!cookieValue) return null

  try {
    return JSON.parse(decodeURIComponent(cookieValue))
  } catch {
    return null
  }
}

const setOnboardingSession = (session: OnboardingSessionState): void => {
  if (typeof document === 'undefined') return

  const maxAge = SESSION_TIMEOUT_HOURS * 60 * 60 // 24 hours in seconds
  const encoded = encodeURIComponent(JSON.stringify(session))
  document.cookie = `${ONBOARDING_COOKIE_NAME}=${encoded}; max-age=${maxAge}; path=/; SameSite=Lax`
}

const clearOnboardingSession = (): void => {
  if (typeof document === 'undefined') return
  document.cookie = `${ONBOARDING_COOKIE_NAME}=; max-age=0; path=/`
}

interface UseOnboardingTrackingReturn {
  /**
   * Start onboarding tracking. Call when user enters /dashboard/create without an org.
   * Returns session state if started successfully, null if user already has orgs.
   * Experiment exposure is fired server-side atomically with the started event.
   */
  startOnboarding: (
    signupMethod: SignupMethod,
  ) => Promise<OnboardingSessionState | null>

  trackStepStarted: (
    step: OnboardingStep,
    organizationId?: string,
  ) => Promise<void>

  trackStepCompleted: (
    step: OnboardingStep,
    organizationId?: string,
  ) => Promise<void>

  trackStepSkipped: (
    step: OnboardingStep,
    organizationId?: string,
  ) => Promise<void>

  trackCompleted: (organizationId: string) => Promise<void>

  getSession: () => OnboardingSessionState | null

  clearSession: () => void

  experimentVariant: string
}

export const useOnboardingTracking = (): UseOnboardingTrackingReturn => {
  const posthog = usePostHog()


  const { variant: experimentVariant } = useExperiment('onboarding_flow_v1', {
    trackExposure: false,
  })

  const startOnboarding = useCallback(
    async (
      signupMethod: SignupMethod,
    ): Promise<OnboardingSessionState | null> => {
      const existingSession = getOnboardingSession()
      const distinctId = posthog?.get_distinct_id() || undefined

      try {
        const response = await fetch(`${API_BASE_URL}/v1/onboarding/started`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            signup_method: signupMethod,
            distinct_id: distinctId,
            session_id: existingSession?.session_id,
            started_at: existingSession?.started_at,
            experiment_name: 'onboarding_flow_v1',
            experiment_variant: experimentVariant,
          }),
        })

        if (!response.ok) {

          clearOnboardingSession()
          return null
        }

        const session: OnboardingSessionState = await response.json()
        setOnboardingSession(session)
        return session
      } catch {

        return null
      }
    },
    [posthog, experimentVariant],
  )

  const trackStepStarted = useCallback(
    async (step: OnboardingStep, organizationId?: string): Promise<void> => {
      const session = getOnboardingSession()
      if (!session) return

      const distinctId = posthog?.get_distinct_id() || undefined
      const queryParams = distinctId ? `?distinct_id=${distinctId}` : ''

      try {
        await fetch(
          `${API_BASE_URL}/v1/onboarding/step/${step}/started${queryParams}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              session_id: session.session_id,
              organization_id: organizationId,
              experiment_variant: session.experiment_variant,
            }),
          },
        )

        setOnboardingSession({
          ...session,
          current_step: step,
        })
      } catch {
        console.warn('Failed to track step started')
      }
    },
    [posthog],
  )

  const trackStepCompleted = useCallback(
    async (step: OnboardingStep, organizationId?: string): Promise<void> => {
      const session = getOnboardingSession()
      if (!session) return

      const distinctId = posthog?.get_distinct_id() || undefined
      const queryParams = distinctId ? `?distinct_id=${distinctId}` : ''

      try {
        await fetch(
          `${API_BASE_URL}/v1/onboarding/step/${step}/completed${queryParams}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              session_id: session.session_id,
              organization_id: organizationId,
              experiment_variant: session.experiment_variant,
            }),
          },
        )

        setOnboardingSession({
          ...session,
          steps_completed: session.steps_completed + 1,
        })
      } catch {
        // Don't block user flow on tracking errors
      }
    },
    [posthog],
  )

  const trackStepSkipped = useCallback(
    async (step: OnboardingStep, organizationId?: string): Promise<void> => {
      const session = getOnboardingSession()
      if (!session) return

      const distinctId = posthog?.get_distinct_id() || undefined
      const queryParams = distinctId ? `?distinct_id=${distinctId}` : ''

      try {
        await fetch(
          `${API_BASE_URL}/v1/onboarding/step/${step}/skipped${queryParams}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              session_id: session.session_id,
              organization_id: organizationId,
              experiment_variant: session.experiment_variant,
            }),
          },
        )
      } catch {
        // Don't block user flow on tracking errors
      }
    },
    [posthog],
  )

  const trackCompleted = useCallback(
    async (organizationId: string): Promise<void> => {
      const session = getOnboardingSession()
      if (!session) return

      const distinctId = posthog?.get_distinct_id() || undefined
      const queryParams = distinctId ? `?distinct_id=${distinctId}` : ''

      try {
        await fetch(`${API_BASE_URL}/v1/onboarding/completed${queryParams}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            session_id: session.session_id,
            organization_id: organizationId,
            experiment_variant: session.experiment_variant,
          }),
        })

        clearOnboardingSession()
      } catch {
        // Don't block user flow on tracking errors
      }
    },
    [posthog],
  )

  const getSession = useCallback((): OnboardingSessionState | null => {
    return getOnboardingSession()
  }, [])

  const clearSession = useCallback((): void => {
    clearOnboardingSession()
  }, [])

  return useMemo(
    () => ({
      startOnboarding,
      trackStepStarted,
      trackStepCompleted,
      trackStepSkipped,
      trackCompleted,
      getSession,
      clearSession,
      experimentVariant,
    }),
    [
      startOnboarding,
      trackStepStarted,
      trackStepCompleted,
      trackStepSkipped,
      trackCompleted,
      getSession,
      clearSession,
      experimentVariant,
    ],
  )
}
