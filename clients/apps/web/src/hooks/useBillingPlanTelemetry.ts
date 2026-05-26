'use client'

import { usePostHog } from '@/hooks/posthog'
import {
  BillingPlanAttribution,
  BillingPlanSource,
  BillingPlanUrls,
  buildBillingPlanUrls,
  readBillingPlanCancelPayload,
  readBillingPlanCompletePayload,
} from '@/utils/billingPlanTelemetry'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef } from 'react'

export type { BillingPlanAttribution, BillingPlanSource, BillingPlanUrls }

interface UseBillingPlanTelemetryOptions {
  source: BillingPlanSource
  organizationId: string
  successPath: string
}

/**
 * For components that initiate a Polar billing-plan checkout redirect.
 * Returns a builder for the success/return URLs (UTM + attribution baked
 * in), and silently listens on the current page for the cancellation
 * return — firing `dashboard:subscriptions:checkout:cancel` and stripping
 * the URL params.
 */
export const useBillingPlanTelemetry = ({
  source,
  organizationId,
  successPath,
}: UseBillingPlanTelemetryOptions): {
  buildUrls: (attribution: BillingPlanAttribution) => BillingPlanUrls
} => {
  const posthog = usePostHog()
  const router = useRouter()
  const searchParams = useSearchParams()
  const firedRef = useRef(false)

  useEffect(() => {
    if (firedRef.current) return
    const payload = readBillingPlanCancelPayload(
      searchParams,
      organizationId,
      source,
    )
    if (!payload) return
    firedRef.current = true
    posthog.capture('dashboard:subscriptions:checkout:cancel', payload)
    router.replace(window.location.pathname)
  }, [searchParams, router, posthog, organizationId, source])

  const buildUrls = useCallback(
    (attribution: BillingPlanAttribution): BillingPlanUrls =>
      buildBillingPlanUrls({
        source,
        attribution,
        origin: window.location.origin,
        successPath,
        cancelPath: window.location.pathname,
      }),
    [source, successPath],
  )

  return { buildUrls }
}

interface UseBillingPlanCompleteListenerOptions {
  organizationId: string
  redirectPath: string
  onComplete?: () => void
}

/**
 * For the page hit by `success_url` after a Polar billing-plan checkout.
 * Fires `dashboard:subscriptions:checkout:complete` only when both
 * `checkout_success=true` AND `utm_source` are present. Runs `onComplete`
 * for any side-effect (cache invalidation), then strips the params via
 * `router.replace`.
 */
export const useBillingPlanCompleteListener = ({
  organizationId,
  redirectPath,
  onComplete,
}: UseBillingPlanCompleteListenerOptions): void => {
  const posthog = usePostHog()
  const router = useRouter()
  const searchParams = useSearchParams()
  const firedRef = useRef(false)

  useEffect(() => {
    if (firedRef.current) return
    if (searchParams.get('checkout_success') !== 'true') return
    firedRef.current = true
    const payload = readBillingPlanCompletePayload(searchParams, organizationId)
    if (payload) {
      posthog.capture('dashboard:subscriptions:checkout:complete', payload)
    }
    onComplete?.()
    router.replace(redirectPath)
  }, [searchParams, router, posthog, organizationId, redirectPath, onComplete])
}
