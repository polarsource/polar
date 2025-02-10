'use client'

import { useProducts } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import React, { useMemo } from 'react'

const stub = (): never => {
  throw new Error(
    'You forgot to wrap your component in <MaintainerOrganizationContextProvider>.',
  )
}

interface MaintainerOrganizationContextType {
  organization: schemas['Organization']
  organizations: schemas['Organization'][]
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
  organization: schemas['Organization']
  organizations: schemas['Organization'][]
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

const useOnboardingState = (organization: schemas['Organization']) => {
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
