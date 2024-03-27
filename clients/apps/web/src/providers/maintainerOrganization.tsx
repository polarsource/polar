'use client'

import { Organization } from '@polar-sh/sdk'
import React from 'react'

export const MaintainerOrganizationContext = React.createContext<
  | {
      organization: Organization
      memberOrganizations: Organization[]
      adminOrganizations: Organization[]
      personalOrganization: Organization | undefined
    }
  | undefined
>(undefined)

export const MaintainerOrganizationContextProvider = ({
  organization,
  memberOrganizations,
  adminOrganizations,
  personalOrganization,
  children,
}: {
  organization: Organization
  memberOrganizations: Organization[]
  adminOrganizations: Organization[]
  personalOrganization: Organization | undefined
  children: React.ReactNode
}) => {
  return (
    <MaintainerOrganizationContext.Provider
      value={{
        organization,
        memberOrganizations,
        adminOrganizations,
        personalOrganization,
      }}
    >
      {children}
    </MaintainerOrganizationContext.Provider>
  )
}
