import { useCallback, useSyncExternalStore } from 'react'

interface UseLocalStorageOptions<T> {
  /**
   * Optional validator. Parsed values that fail validation fall back to
   * `defaultValue` (and the bad value stays in storage — they can be
   * cleared by the caller if needed).
   */
  validate?: (value: unknown) => value is T
  /**
   * Custom serializer. Defaults to `JSON.stringify`. Pass an identity fn
   * (`v => v`) when storing raw strings.
   */
  serialize?: (value: T) => string
  /**
   * Custom deserializer. Defaults to `JSON.parse`. Pass `raw => raw as T`
   * when reading raw strings.
   */
  deserialize?: (raw: string) => T
}

/**
 * Custom event name used to broadcast same-tab writes. The browser's
 * built-in `storage` event only fires in *other* tabs, so a per-tab event
 * is needed to keep subscribers in the writing tab in sync.
 */
const CHANGED_EVENT = 'polar:local-storage-changed'

/**
 * Module-level cache so the snapshot returned to React stays
 * `Object.is`-stable when the underlying raw string hasn't changed.
 * Without this, `useSyncExternalStore` would treat each JSON.parse result
 * (or any deserialised object) as a new value and infinite-loop.
 */
const cache = new Map<string, { raw: string | null; value: unknown }>()

const subscribe = (callback: () => void): (() => void) => {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('storage', callback)
  window.addEventListener(CHANGED_EVENT, callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener(CHANGED_EVENT, callback)
  }
}

const readFromStorage = <T>(
  key: string,
  defaultValue: T,
  deserialize: (raw: string) => T,
  validate: ((value: unknown) => value is T) | undefined,
): T => {
  if (typeof window === 'undefined') return defaultValue
  let raw: string | null
  try {
    raw = window.localStorage.getItem(key)
  } catch {
    return defaultValue
  }
  const cached = cache.get(key)
  if (cached && cached.raw === raw) return cached.value as T

  let value: T
  if (raw === null) {
    value = defaultValue
  } else {
    try {
      const parsed = deserialize(raw)
      value = validate && !validate(parsed) ? defaultValue : parsed
    } catch {
      value = defaultValue
    }
  }
  cache.set(key, { raw, value })
  return value
}

/**
 * `useState`-shaped hook backed by `localStorage`, with:
 *
 * - SSR-safe read (falls back to `defaultValue` server-side, hydrates to
 *   the persisted value via `useSyncExternalStore`).
 * - Cross-tab sync via the native `storage` event.
 * - Same-tab sync across hook instances via a custom event.
 * - Stable references for parsed objects/arrays (cached per key).
 * - Graceful fallback when `localStorage` throws (private mode, quota).
 *
 * Defaults to JSON serialisation. Pass identity serialisers in the
 * options bag when storing raw strings (preserves backward compatibility
 * with existing keys that weren't JSON-encoded).
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  options?: UseLocalStorageOptions<T>,
): [T, (next: T) => void] {
  const serialize = options?.serialize ?? (JSON.stringify as (v: T) => string)
  const deserialize = options?.deserialize ?? (JSON.parse as (raw: string) => T)
  const validate = options?.validate

  const getSnapshot = useCallback(
    () => readFromStorage(key, defaultValue, deserialize, validate),
    [key, defaultValue, deserialize, validate],
  )

  const value = useSyncExternalStore(subscribe, getSnapshot, () => defaultValue)

  const setValue = useCallback(
    (next: T) => {
      try {
        window.localStorage.setItem(key, serialize(next))
      } catch {
        // ignore — dispatch anyway so subscribers re-read and stay
        // consistent with whatever is (still) in storage.
      }
      cache.delete(key)
      window.dispatchEvent(new Event(CHANGED_EVENT))
    },
    [key, serialize],
  )

  return [value, setValue]
}
