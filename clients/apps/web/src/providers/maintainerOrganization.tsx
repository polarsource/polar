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
  memberOrganizations: Organization[]
  adminOrganizations: Organization[]
}

export const MaintainerOrganizationContext =
  // @ts-ignore
  React.createContext<MaintainerOrganizationContextType>(stub)

export const MaintainerOrganizationContextProvider = ({
  organization,
  memberOrganizations,
  adminOrganizations,
  children,
}: {
  organization: Organization
  memberOrganizations: Organization[]
  adminOrganizations: Organization[]
  children: React.ReactNode
}) => {
  return (
    <MaintainerOrganizationContext.Provider
      value={{
        organization,
        memberOrganizations,
        adminOrganizations,
      }}
    >
      {children}
    </MaintainerOrganizationContext.Provider>
  )
}
