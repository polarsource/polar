'use client'

import { useCustomerSSE } from '@/hooks/sse'
import { createClient, type Client } from '@polar-sh/client'
import type EventEmitter from 'eventemitter3'
import React, { createContext, useContext, useMemo } from 'react'

export interface CustomerPortalContextValue {
  client: Client
  organizationId: string
  organizationSlug: string
  customerSSE: EventEmitter
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
  const customerSSE = useCustomerSSE(token)

  const value: CustomerPortalContextValue = useMemo(
    () => ({
      client,
      organizationId,
      organizationSlug,
      customerSSE,
    }),
    [client, organizationId, organizationSlug, customerSSE],
  )

  return (
    <CustomerPortalContext.Provider value={value}>
      {children}
    </CustomerPortalContext.Provider>
  )
}
