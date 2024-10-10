'use client'

import { useProducts } from '@/hooks/queries'
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
    loading: boolean
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
  const { data: products, isLoading } = useProducts(organization.id, {
    limit: 1,
  })

  const shouldUpsellOrders = useMemo(
    () => products?.pagination.total_count === 0,
    [products],
  )

  return {
    completed: !shouldUpsellOrders,
    loading: isLoading,
  }
}
