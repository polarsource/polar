'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

const STORAGE_KEY = 'polar_onboarding_v2'

export interface OnboardingData {
  // Screen 1 — Personal
  fullName?: string
  country?: string
  dateOfBirth?: string

  // Screen 2 — Business
  organizationType?: 'individual' | 'business'
  orgName?: string
  orgSlug?: string
  website?: string
  supportEmail?: string
  businessCountry?: string
  teamSize?: string
  ventureBacked?: boolean
  mainInvestor?: string
  socials?: { platform: string; url: string }[]
  defaultCurrency?: string
  organizationId?: string

  // Screen 3 — Product
  sellingCategories?: string[]
  productDescription?: string
  pricingModel?: string
  meteredCredits?: boolean
  currentlySellingOn?: string[]
  productWebsite?: string
}

interface OnboardingContextValue {
  data: OnboardingData
  updateData: (partial: Partial<OnboardingData>) => void
  clearData: () => void
  /** Show a mock API response in the preview, auto-clears after duration */
  showApiResponse: (status: number, message: string) => Promise<void>
  apiResponse: { status: number; message: string } | null
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null)

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

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<OnboardingData>(loadFromSession)
  const [apiResponse, setApiResponse] = useState<{ status: number; message: string } | null>(null)

  useEffect(() => {
    saveToSession(data)
  }, [data])

  const updateData = useCallback((partial: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...partial }))
  }, [])

  const clearData = useCallback(() => {
    setData({})
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  const showApiResponse = useCallback((status: number, message: string) => {
    return new Promise<void>((resolve) => {
      setApiResponse({ status, message })
      setTimeout(() => {
        setApiResponse(null)
        resolve()
      }, 1200)
    })
  }, [])

  const value = useMemo(
    () => ({ data, updateData, clearData, showApiResponse, apiResponse }),
    [data, updateData, clearData, showApiResponse, apiResponse],
  )

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  )
}

export function useOnboardingData(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext)
  if (!ctx) {
    throw new Error('useOnboardingData must be used within OnboardingProvider')
  }
  return ctx
}
