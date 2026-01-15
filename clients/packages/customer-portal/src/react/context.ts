import { createContext, useContext } from 'react'
import type { PortalClient } from '../core/client'

export interface CustomerPortalContextValue {
  client: PortalClient
  organizationId: string
  organizationSlug: string
}

export const CustomerPortalContext =
  createContext<CustomerPortalContextValue | null>(null)

export function useCustomerPortalContext(): CustomerPortalContextValue {
  const context = useContext(CustomerPortalContext)
  if (!context) {
    throw new Error(
      'useCustomerPortalContext must be used within a CustomerPortalProvider',
    )
  }
  return context
}
