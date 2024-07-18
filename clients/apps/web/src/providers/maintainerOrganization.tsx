'use client'

import { Organization } from '@polar-sh/sdk'
import React from 'react'

const stub = (): never => {
  throw new Error(
    'You forgot to wrap your component in <MaintainerOrganizationContextProvider>.',
  )
}

interface MaintainerOrganizationContextType {
  organization: Organization
  organizations: Organization[]
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
  return (
    <MaintainerOrganizationContext.Provider
      value={{
        organization,
        organizations,
      }}
    >
      {children}
    </MaintainerOrganizationContext.Provider>
  )
}
