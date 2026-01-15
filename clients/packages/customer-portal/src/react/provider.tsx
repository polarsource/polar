import React, { useMemo } from 'react'
import { createPortalClient } from '../core/client'
import {
  CustomerPortalContext,
  type CustomerPortalContextValue,
} from './context'

export interface CustomerPortalProviderProps {
  token: string
  organizationId: string
  organizationSlug: string
  baseUrl?: string
  onUnauthorized: () => void
  children: React.ReactNode
}

export function CustomerPortalProvider({
  token,
  organizationId,
  organizationSlug,
  baseUrl,
  onUnauthorized,
  children,
}: CustomerPortalProviderProps) {
  const client = useMemo(
    () =>
      createPortalClient({
        token,
        organizationId,
        organizationSlug,
        baseUrl,
        onUnauthorized,
      }),
    [token, organizationId, organizationSlug, baseUrl, onUnauthorized],
  )

  const value: CustomerPortalContextValue = useMemo(
    () => ({
      client,
      organizationId,
      organizationSlug,
    }),
    [client, organizationId, organizationSlug],
  )

  return (
    <CustomerPortalContext.Provider value={value}>
      {children}
    </CustomerPortalContext.Provider>
  )
}
