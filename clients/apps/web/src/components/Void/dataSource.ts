'use client'

import { useSyncExternalStore } from 'react'

/**
 * Where the Void dashboard reads from: the in-repo fixtures that drive the
 * design work, or the live Void API. Per browser, so a reviewer can flip it
 * without touching anyone else's view.
 */
export type VoidDataSource = 'fixtures' | 'live'

const STORAGE_KEY = 'void-data-source'
const DEFAULT: VoidDataSource = 'fixtures'

let state: VoidDataSource | null = null
const listeners = new Set<() => void>()

const load = (): VoidDataSource => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw === 'live' || raw === 'fixtures' ? raw : DEFAULT
  } catch {
    return DEFAULT
  }
}

const getSnapshot = () => (state ??= load())
const getServerSnapshot = () => DEFAULT
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const setVoidDataSource = (next: VoidDataSource) => {
  state = next
  try {
    window.localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // The choice still applies for this session.
  }
  listeners.forEach((listener) => listener())
}

export const useVoidDataSource = () =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
