'use client'

import { usePostHog } from 'posthog-js/react'
import { useEffect, useMemo, useRef } from 'react'
import { useExperimentContext } from './ExperimentProvider'
import { DISTINCT_ID_COOKIE, isCookielessPath } from './constants'
import {
  type ExperimentName,
  type ExperimentResult,
  type ExperimentVariant,
  experiments,
  getDefaultVariant,
} from './index'

/**
 * We only track experiment exposure when the client and the server use the
 * same distinct ID. Without this, funnel analysis breaks due to ID mismatches.
 *
 * Checkout never uses the cookie: its ID is derived from the checkout and
 * rendered into the page, so it always matches.
 *
 * Elsewhere the ID comes from the polar_distinct_id cookie, which may be
 * missing with strict browser privacy settings, tracking prevention
 * (Safari ITP, Firefox ETP), or incognito mode.
 */
function sharesDistinctIdWithServer(): boolean {
  if (typeof document === 'undefined') return false
  return (
    isCookielessPath(window.location.pathname) ||
    document.cookie.includes(`${DISTINCT_ID_COOKIE}=`)
  )
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

  const canTrack = useMemo(() => sharesDistinctIdWithServer(), [])

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
