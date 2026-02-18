'use client'

import { usePostHog } from 'posthog-js/react'
import { useEffect, useMemo, useRef } from 'react'
import { useExperimentContext } from './ExperimentProvider'
import {
  type ExperimentName,
  type ExperimentResult,
  getDefaultVariant,
  isOrgOptedOut,
} from './index'

export interface UseExperimentOptions {
  trackExposure?: boolean
  orgId?: string
}

export function useExperiment<T extends ExperimentName>(
  experimentName: T,
  options?: UseExperimentOptions,
): ExperimentResult<T> {
  const { trackExposure = true, orgId: optionsOrgId } = options ?? {}
  const posthog = usePostHog()
  const hasTracked = useRef(false)
  const { experiments, orgId: contextOrgId } = useExperimentContext()

  const orgId = optionsOrgId ?? contextOrgId
  const isOptedOut = isOrgOptedOut(experimentName, orgId)

  const variant = isOptedOut
    ? getDefaultVariant(experimentName)
    : (experiments[experimentName] ?? getDefaultVariant(experimentName))

  useEffect(() => {
    if (isOptedOut) {
      return
    }

    if (!trackExposure || hasTracked.current) {
      return
    }

    hasTracked.current = true

    posthog.capture('$feature_flag_called', {
      $feature_flag: experimentName,
      $feature_flag_response: variant,
    })
  }, [experimentName, variant, trackExposure, isOptedOut, posthog])

  return useMemo(
    () => ({
      variant,
      isControl: variant === 'control',
      isTreatment: variant === 'treatment',
    }),
    [variant],
  )
}
