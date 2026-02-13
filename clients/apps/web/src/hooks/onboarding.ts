'use client'

import { useExperiment } from '@/experiments/client'
import { schemas } from '@polar-sh/client'
import { usePostHog } from 'posthog-js/react'
import { useCallback, useMemo } from 'react'

const ONBOARDING_COOKIE_NAME = 'polar_onboarding_session'
const SESSION_TIMEOUT_HOURS = 24

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

  const maxAge = SESSION_TIMEOUT_HOURS * 60 * 60
  const encoded = encodeURIComponent(JSON.stringify(session))
  document.cookie = `${ONBOARDING_COOKIE_NAME}=${encoded}; max-age=${maxAge}; path=/; SameSite=Lax`
}

const clearOnboardingSession = (): void => {
  if (typeof document === 'undefined') return
  document.cookie = `${ONBOARDING_COOKIE_NAME}=; max-age=0; path=/`
}

interface UseOnboardingTrackingReturn {
  startOnboarding: (signupMethod: SignupMethod) => OnboardingSessionState | null
  trackStepStarted: (step: OnboardingStep, organizationId?: string) => void
  trackStepCompleted: (step: OnboardingStep, organizationId?: string) => void
  trackStepSkipped: (step: OnboardingStep, organizationId?: string) => void
  trackCompleted: (organizationId: string) => void
  getSession: () => OnboardingSessionState | null
  clearSession: () => void
  experimentVariant: string
}

export const useOnboardingTracking = (): UseOnboardingTrackingReturn => {
  const posthog = usePostHog()

  const { variant: experimentVariant } = useExperiment('onboarding_flow_v1', {
    trackExposure: false,
  })

  const captureEvent = useCallback(
    (
      event: string,
      properties: Record<string, string | number | null | undefined>,
    ) => {
      posthog?.capture(event, properties)
    },
    [posthog],
  )

  const startOnboarding = useCallback(
    (signupMethod: SignupMethod): OnboardingSessionState | null => {
      const existingSession = getOnboardingSession()

      if (existingSession) {
        return existingSession
      }

      const sessionId = crypto.randomUUID()
      const startedAt = new Date().toISOString()

      posthog?.capture('$feature_flag_called', {
        $feature_flag: 'onboarding_flow_v1',
        $feature_flag_response: experimentVariant,
      })

      captureEvent('dashboard:onboarding:started', {
        onboarding_session_id: sessionId,
        signup_method: signupMethod,
        '$feature/onboarding_flow_v1': experimentVariant,
      })

      const session: OnboardingSessionState = {
        session_id: sessionId,
        started_at: startedAt,
        current_step: 'org',
        steps_completed: 0,
        signup_method: signupMethod,
        experiment_variant: experimentVariant,
      }

      setOnboardingSession(session)
      return session
    },
    [posthog, experimentVariant, captureEvent],
  )

  const trackStepStarted = useCallback(
    (step: OnboardingStep, organizationId?: string): void => {
      const session = getOnboardingSession()
      if (!session || session.current_step === step) return

      captureEvent(`dashboard:onboarding:step:${step}:started`, {
        onboarding_session_id: session.session_id,
        step,
        organization_id: organizationId,
        experiment_variant: session.experiment_variant,
      })

      setOnboardingSession({ ...session, current_step: step })
    },
    [captureEvent],
  )

  const trackStepCompleted = useCallback(
    (step: OnboardingStep, organizationId?: string): void => {
      const session = getOnboardingSession()
      if (!session) return

      captureEvent(`dashboard:onboarding:step:${step}:completed`, {
        onboarding_session_id: session.session_id,
        step,
        organization_id: organizationId,
        experiment_variant: session.experiment_variant,
      })

      setOnboardingSession({
        ...session,
        steps_completed: session.steps_completed + 1,
      })
    },
    [captureEvent],
  )

  const trackStepSkipped = useCallback(
    (step: OnboardingStep, organizationId?: string): void => {
      const session = getOnboardingSession()
      if (!session) return

      captureEvent(`dashboard:onboarding:step:${step}:skipped`, {
        onboarding_session_id: session.session_id,
        step,
        organization_id: organizationId,
        experiment_variant: session.experiment_variant,
      })
    },
    [captureEvent],
  )

  const trackCompleted = useCallback(
    (organizationId: string): void => {
      const session = getOnboardingSession()
      if (!session) return

      captureEvent('dashboard:onboarding:completed', {
        onboarding_session_id: session.session_id,
        organization_id: organizationId,
        experiment_variant: session.experiment_variant,
      })

      clearOnboardingSession()
    },
    [captureEvent],
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
