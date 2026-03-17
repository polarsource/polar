'use client'

import {
  createContext,
  useCallback,
  useContext,
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
  /** Read current data without subscribing to changes (no re-renders) */
  getData: () => OnboardingData
  /** Write data — notifies subscribers but does NOT re-render the caller */
  updateData: (partial: Partial<OnboardingData>) => void
  clearData: () => void
  /** Subscribe to data changes (used by APIPreview) */
  subscribe: (listener: () => void) => () => void
  showApiResponse: (status: number, message: string) => Promise<void>
}

interface OnboardingContextValue extends OnboardingStore {
  apiResponse: { status: number; message: string } | null
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null)

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const dataRef = useRef<OnboardingData>(loadFromSession())
  const listenersRef = useRef(new Set<() => void>())
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

  const showApiResponse = useCallback((status: number, message: string) => {
    setApiResponse({ status, message })
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        setApiResponse(null)
        resolve()
      }, 2500)
    })
  }, [])

  // Stable ref — never changes, so provider never triggers consumer re-renders
  const valueRef = useRef<OnboardingContextValue>({
    getData,
    updateData,
    clearData,
    subscribe,
    showApiResponse,
    apiResponse: null,
  })
  // Only apiResponse triggers a re-render (for the response animation)
  valueRef.current.apiResponse = apiResponse

  return (
    <OnboardingContext.Provider value={valueRef.current}>
      {children}
    </OnboardingContext.Provider>
  )
}

/** Use in form steps — reads data once, writes without re-rendering */
export function useOnboardingData() {
  const ctx = useContext(OnboardingContext)
  if (!ctx) {
    throw new Error('useOnboardingData must be used within OnboardingProvider')
  }
  return {
    data: ctx.getData(),
    updateData: ctx.updateData,
    clearData: ctx.clearData,
    showApiResponse: ctx.showApiResponse,
    apiResponse: ctx.apiResponse,
    apiPending: false,
  }
}

/** Use in APIPreview — subscribes to data changes and re-renders on every update */
export function useOnboardingDataLive(): OnboardingData {
  const ctx = useContext(OnboardingContext)
  if (!ctx) {
    throw new Error(
      'useOnboardingDataLive must be used within OnboardingProvider',
    )
  }
  return useSyncExternalStore(ctx.subscribe, ctx.getData, ctx.getData)
}
