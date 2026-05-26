'use client'

import { EventName, usePostHog } from '@/hooks/posthog'
import type { JsonType } from '@posthog/core'
import { useEffect, useRef } from 'react'

interface UseImpressionEventOptions {
  event: EventName
  // Defaults to true. Pass false to suppress the impression until the
  // condition becomes true (e.g. data loaded, component visible).
  enabled?: boolean
  // Invoked exactly when the event fires, so properties never go stale and
  // we don't pay the cost on renders where the impression is suppressed.
  build: () => Record<string, JsonType>
}

/**
 * Fire a PostHog event exactly once, the first time `enabled` is true. Use
 * for impression / "was shown" telemetry where we want a single capture per
 * mount, regardless of re-renders from data refetches.
 */
export const useImpressionEvent = ({
  event,
  enabled = true,
  build,
}: UseImpressionEventOptions): void => {
  const posthog = usePostHog()
  const firedRef = useRef(false)

  useEffect(() => {
    if (!enabled) return
    if (firedRef.current) return
    firedRef.current = true
    posthog.capture(event, build())
    // Intentionally only re-run when `enabled` flips — `build`, `event`,
    // and `posthog` are read freshly via the closure but should not cause
    // refires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])
}
