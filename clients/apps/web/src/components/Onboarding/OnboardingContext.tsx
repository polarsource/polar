'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'

const STORAGE_KEY = 'polar_onboarding_v2'

export interface OnboardingData {
  // Screen 1 — Personal
  firstName?: string
  lastName?: string
  country?: string
  dateOfBirth?: string

  // Screen 2 — Business
  organizationType?: 'individual' | 'company'
  orgName?: string
  orgSlug?: string
  website?: string
  supportEmail?: string
  businessCountry?: string
  teamSize?: string
  registeredBusinessName?: string
  ventureBacked?: boolean
  mainInvestor?: string
  socials?: { platform: string; url: string }[]
  defaultCurrency?: string
  organizationId?: string

  // Screen 3 — Product
  buildingIntent?: string[]
  sellingCategories?: string[]
  productDescription?: string
  pricingModel?: string[]
  meteredCredits?: boolean
  currentlySellingOn?: string[]
  productUrl?: string
}

function loadFromSession(): OnboardingData {
  if (typeof window === 'undefined') return {}
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

function saveToSession(data: OnboardingData): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // ignore quota errors
  }
}

interface OnboardingStore {
  getData: () => OnboardingData
  updateData: (partial: Partial<OnboardingData>) => void
  clearData: () => void
  subscribe: (listener: () => void) => () => void
  setApiLoading: (loading: boolean) => void
  showApiResponse: (status: number, message: string) => Promise<void>
  clearApiResponse: () => void
}

interface OnboardingContextValue extends OnboardingStore {
  apiLoading: boolean
  apiResponse: { status: number; message: string } | null
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null)

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const dataRef = useRef<OnboardingData>(loadFromSession())
  const listenersRef = useRef(new Set<() => void>())
  const [apiLoading, setApiLoadingState] = useState(false)
  const [apiResponse, setApiResponse] = useState<{
    status: number
    message: string
  } | null>(null)

  const subscribe = useCallback((listener: () => void) => {
    listenersRef.current.add(listener)
    return () => {
      listenersRef.current.delete(listener)
    }
  }, [])

  const notify = useCallback(() => {
    for (const listener of listenersRef.current) {
      listener()
    }
  }, [])

  const getData = useCallback(() => dataRef.current, [])

  const updateData = useCallback(
    (partial: Partial<OnboardingData>) => {
      dataRef.current = { ...dataRef.current, ...partial }
      saveToSession(dataRef.current)
      notify()
    },
    [notify],
  )

  const clearData = useCallback(() => {
    dataRef.current = {}
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(STORAGE_KEY)
    }
    notify()
  }, [notify])

  const setApiLoading = useCallback((loading: boolean) => {
    setApiLoadingState(loading)
    if (loading) {
      setApiResponse(null)
    }
  }, [])

  const clearApiResponse = useCallback(() => {
    setApiResponse(null)
  }, [])

  const showApiResponse = useCallback((status: number, message: string) => {
    setApiLoadingState(false)
    setApiResponse({ status, message })
    if (status >= 400) {
      // Errors stay visible until the next action clears them
      return Promise.resolve()
    }
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve()
      }, 2500)
    })
  }, [])

  const value = useMemo<OnboardingContextValue>(
    () => ({
      getData,
      updateData,
      clearData,
      subscribe,
      setApiLoading,
      showApiResponse,
      clearApiResponse,
      apiLoading,
      apiResponse,
    }),
    [
      getData,
      updateData,
      clearData,
      subscribe,
      setApiLoading,
      showApiResponse,
      clearApiResponse,
      apiLoading,
      apiResponse,
    ],
  )

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  )
}

export function useOnboardingData() {
  const ctx = useContext(OnboardingContext)
  if (!ctx) {
    throw new Error('useOnboardingData must be used within OnboardingProvider')
  }
  return {
    data: ctx.getData(),
    updateData: ctx.updateData,
    clearData: ctx.clearData,
    setApiLoading: ctx.setApiLoading,
    showApiResponse: ctx.showApiResponse,
    clearApiResponse: ctx.clearApiResponse,
    apiLoading: ctx.apiLoading,
    apiResponse: ctx.apiResponse,
  }
}

export function useOnboardingDataLive(): OnboardingData {
  const ctx = useContext(OnboardingContext)
  if (!ctx) {
    throw new Error(
      'useOnboardingDataLive must be used within OnboardingProvider',
    )
  }
  return useSyncExternalStore(ctx.subscribe, ctx.getData, ctx.getData)
}
