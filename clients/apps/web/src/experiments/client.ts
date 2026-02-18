'use client'

import { usePostHog } from 'posthog-js/react'
import { useEffect, useMemo, useRef } from 'react'
import { useExperimentContext } from './ExperimentProvider'
import { DISTINCT_ID_COOKIE } from './constants'
import {
  type ExperimentName,
  type ExperimentResult,
  getDefaultVariant,
} from './index'

/**
 * Check if the polar_distinct_id cookie exists.
 * We only track experiment exposure when this cookie exists to ensure
 * the same distinct ID is used for both client-side experiment events
 * and server-side events. Without this, funnel analysis breaks due to ID mismatches.
 *
 * The cookie may be missing in: embedded checkouts (third-party cookie restrictions),
 * strict browser privacy settings, tracking prevention (Safari ITP, Firefox ETP),
 * or incognito mode.
 */
function hasDistinctIdCookie(): boolean {
  if (typeof document === 'undefined') return false
  return document.cookie.includes(`${DISTINCT_ID_COOKIE}=`)
}

export interface UseExperimentOptions {
  trackExposure?: boolean
}

export function useExperiment<T extends ExperimentName>(
  experimentName: T,
  options?: UseExperimentOptions,
): ExperimentResult<T> {
  const { trackExposure = true } = options ?? {}
  const posthog = usePostHog()
  const hasTracked = useRef(false)
  const experiments = useExperimentContext()

  const variant =
    experiments[experimentName] ?? getDefaultVariant(experimentName)

  const canTrack = useMemo(() => hasDistinctIdCookie(), [])

  useEffect(() => {
    if (!trackExposure || !canTrack || hasTracked.current) {
      return
    }

    hasTracked.current = true

    posthog.capture('$feature_flag_called', {
      $feature_flag: experimentName,
      $feature_flag_response: variant,
    })
  }, [experimentName, variant, trackExposure, canTrack, posthog])

  return useMemo(
    () => ({
      variant,
      isControl: variant === 'control',
      isTreatment: variant === 'treatment',
    }),
    [variant],
  )
}
