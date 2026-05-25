'use client'

import { useCallback, useState } from 'react'

const STORAGE_PREFIX = 'dismissed:'

const readStored = (key: string): boolean => {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(STORAGE_PREFIX + key) === 'true'
  } catch {
    return false
  }
}

/**
 * Persistently remember a one-shot dismissal in localStorage (e.g. banner /
 * upsell close buttons). `key` is scoped to a namespace so callers can pass a
 * short identifier without colliding with unrelated storage.
 */
export const useDismissed = (
  key: string,
): { isDismissed: boolean; dismiss: () => void } => {
  const [isDismissed, setIsDismissed] = useState(() => readStored(key))

  const dismiss = useCallback(() => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(STORAGE_PREFIX + key, 'true')
    } catch {
      // localStorage unavailable (private mode, quota) — fall back to in-memory
    }
    setIsDismissed(true)
  }, [key])

  return { isDismissed, dismiss }
}
