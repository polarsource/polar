'use client'

import { usePostHog } from 'posthog-js/react'
import { useEffect, useMemo, useRef } from 'react'
import { useExperimentContext } from './ExperimentProvider'
import { DISTINCT_ID_COOKIE } from './constants'
import {
  type ExperimentName,
  type ExperimentResult,
  type ExperimentVariant,
  experiments,
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

/**
 * Read experiment override from URL query params (dev only).
 * Usage: ?experiment_test_experiment=treatment
 */
function getUrlOverride<T extends ExperimentName>(
  experimentName: T,
): ExperimentVariant<T> | null {
  if (process.env.NODE_ENV !== 'development') return null
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const value = params.get(`experiment_${experimentName}`)
  if (!value) return null
  const validVariants = experiments[experimentName]
    .variants as readonly string[]
  if (validVariants.includes(value)) {
    return value as ExperimentVariant<T>
  }
  return null
}

export function useExperiment<T extends ExperimentName>(
  experimentName: T,
  options?: UseExperimentOptions,
): ExperimentResult<T> {
  const { trackExposure = true } = options ?? {}
  const posthog = usePostHog()
  const hasTracked = useRef(false)
  const experimentContext = useExperimentContext()

  const urlOverride = useMemo(
    () => getUrlOverride(experimentName),
    [experimentName],
  )

  const variant =
    urlOverride ??
    experimentContext[experimentName] ??
    getDefaultVariant(experimentName)

  const canTrack = useMemo(() => hasDistinctIdCookie(), [])

  useEffect(() => {
    if (urlOverride || !trackExposure || !canTrack || hasTracked.current) {
      return
    }

    hasTracked.current = true

    posthog.capture('$feature_flag_called', {
      $feature_flag: experimentName,
      $feature_flag_response: variant,
    })
  }, [experimentName, variant, trackExposure, canTrack, posthog, urlOverride])

  return useMemo(
    () => ({
      variant,
      isControl: variant === 'control',
      isTreatment: variant === 'treatment',
    }),
    [variant],
  )
}
