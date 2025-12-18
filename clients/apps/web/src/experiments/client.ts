'use client'

import { usePostHog } from 'posthog-js/react'
import { useEffect, useMemo, useRef } from 'react'
import { useExperimentContext } from './ExperimentProvider'
import {
  type ExperimentName,
  type ExperimentResult,
  getDefaultVariant,
} from './index'

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

  useEffect(() => {
    if (!trackExposure || hasTracked.current) {
      return
    }

    hasTracked.current = true

    posthog.capture('$feature_flag_called', {
      $feature_flag: experimentName,
      $feature_flag_response: variant,
    })
  }, [experimentName, variant, trackExposure, posthog])

  return useMemo(
    () => ({
      variant,
      isControl: variant === 'control',
      isTreatment: variant === 'treatment',
    }),
    [variant],
  )
}
