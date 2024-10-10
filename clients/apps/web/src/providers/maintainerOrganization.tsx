'use client'

import { useOrders } from '@/hooks/queries/orders'
import { Organization } from '@polar-sh/sdk'
import React, { useMemo } from 'react'

const stub = (): never => {
  throw new Error(
    'You forgot to wrap your component in <MaintainerOrganizationContextProvider>.',
  )
}

interface MaintainerOrganizationContextType {
  organization: Organization
  organizations: Organization[]
  onboarding: {
    completed: boolean
  }
}

export const MaintainerOrganizationContext =
  // @ts-ignore
  React.createContext<MaintainerOrganizationContextType>(stub)

export const MaintainerOrganizationContextProvider = ({
  organization,
  organizations,
  children,
}: {
  organization: Organization
  organizations: Organization[]
  children: React.ReactNode
}) => {
  const onboarding = useOnboardingState(organization)

  return (
    <MaintainerOrganizationContext.Provider
      value={{
        organization,
        organizations,
        onboarding,
      }}
    >
      {children}
    </MaintainerOrganizationContext.Provider>
  )
}

const useOnboardingState = (organization: Organization) => {
  const { data: orders, isLoading: ordersLoading } = useOrders(
    organization.id,
    { limit: 1 },
  )

  const isQueriesLoading = ordersLoading

  const shouldUpsellOrders = useMemo(
    () => orders?.pagination.total_count === 0,
    [orders],
  )

  return {
    isQueriesLoading,
    completed: isQueriesLoading || !shouldUpsellOrders,
  }
}
