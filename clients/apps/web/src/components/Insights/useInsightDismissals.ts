'use client'

import { useCallback, useEffect, useState } from 'react'

const keyFor = (organizationId: string) =>
  `polar:insights:dismissed:${organizationId}`

type DismissalReason = 'dismiss' | 'not_useful'

interface DismissalRecord {
  id: string
  reason: DismissalReason
  at: number
}

/**
 * Persists insight dismissals in ``localStorage`` per organization so
 * they survive reload. Two reasons are tracked — ``dismiss`` (read /
 * acknowledged) and ``not_useful`` (negative signal) — even though the
 * rendering treats both as "hide me" today. The distinction is what the
 * real generator should consume to tune future insights.
 */
export const useInsightDismissals = (organizationId: string) => {
  const [records, setRecords] = useState<DismissalRecord[]>([])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(keyFor(organizationId))
      if (raw) setRecords(JSON.parse(raw) as DismissalRecord[])
    } catch {
      // Malformed payload — start fresh.
      setRecords([])
    }
  }, [organizationId])

  const persist = useCallback(
    (next: DismissalRecord[]) => {
      setRecords(next)
      if (typeof window === 'undefined') return
      try {
        window.localStorage.setItem(
          keyFor(organizationId),
          JSON.stringify(next),
        )
      } catch {
        // Quota / private mode — swallow silently; state still drives the UI.
      }
    },
    [organizationId],
  )

  const dismiss = useCallback(
    (id: string, reason: DismissalReason = 'dismiss') => {
      const withoutExisting = records.filter((r) => r.id !== id)
      persist([...withoutExisting, { id, reason, at: Date.now() }])
    },
    [records, persist],
  )

  const reset = useCallback(() => persist([]), [persist])

  const isDismissed = useCallback(
    (id: string) => records.some((r) => r.id === id),
    [records],
  )

  return { dismiss, reset, isDismissed, dismissedCount: records.length }
}
