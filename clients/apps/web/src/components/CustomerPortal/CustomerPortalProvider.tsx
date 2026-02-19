'use client'

import { createClient, type Client } from '@polar-sh/client'
import React, { createContext, useContext, useMemo } from 'react'

export interface CustomerPortalContextValue {
  client: Client
  organizationId: string
  organizationSlug: string
}

const CustomerPortalContext = createContext<CustomerPortalContextValue | null>(
  null,
)

export function useCustomerPortalContext(): CustomerPortalContextValue {
  const context = useContext(CustomerPortalContext)
  if (!context) {
    throw new Error(
      'useCustomerPortalContext must be used within a CustomerPortalProvider',
    )
  }
  return context
}

export interface CustomerPortalProviderProps {
  token: string
  organizationId: string
  organizationSlug: string
  baseUrl?: string
  children: React.ReactNode
}

export function CustomerPortalProvider({
  token,
  organizationId,
  organizationSlug,
  baseUrl,
  children,
}: CustomerPortalProviderProps) {
  const client = useMemo(
    () => createClient(baseUrl || 'https://api.polar.sh', token),
    [token, baseUrl],
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
