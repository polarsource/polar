'use client'

import { schemas } from '@polar-sh/client'
import { PropsWithChildren, createContext, useContext } from 'react'

interface MetricsContextValue {
  organization: schemas['Organization']
  hasRecurringProducts: boolean
  hasOneTimeProducts: boolean
}

export const MetricsContext = createContext<MetricsContextValue | null>(null)

export const useMetricsContext = () => {
  const context = useContext(MetricsContext)
  if (!context) {
    throw new Error(
      'useMetricsContext must be used within MetricsLayoutClient',
    )
  }
  return context
}

export function MetricsLayoutClient({
  organization,
  hasRecurringProducts,
  hasOneTimeProducts,
  children,
}: PropsWithChildren<MetricsContextValue>) {
  return (
    <MetricsContext.Provider
      value={{ organization, hasRecurringProducts, hasOneTimeProducts }}
    >
      {children}
    </MetricsContext.Provider>
  )
}
