'use client'

import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useCallback } from 'react'

const STORAGE_PREFIX = 'dismissed:'

const serialize = (value: boolean): string => (value ? 'true' : 'false')
const deserialize = (raw: string): boolean => raw === 'true'

/**
 * Persistently remember a one-shot dismissal in localStorage (e.g. banner /
 * upsell close buttons). `key` is scoped to a namespace so callers can pass a
 * short identifier without colliding with unrelated storage.
 */
export const useDismissed = (
  key: string,
): { isDismissed: boolean; dismiss: () => void } => {
  const [isDismissed, setDismissed] = useLocalStorage<boolean>(
    STORAGE_PREFIX + key,
    false,
    { serialize, deserialize },
  )

  const dismiss = useCallback(() => setDismissed(true), [setDismissed])

  return { isDismissed, dismiss }
}
