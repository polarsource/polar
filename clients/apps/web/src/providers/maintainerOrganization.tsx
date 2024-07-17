'use client'

import { Organization } from '@polar-sh/sdk'
import React from 'react'

export const MaintainerOrganizationContext = React.createContext<
  | {
      organization: Organization | undefined
      memberOrganizations: Organization[]
      adminOrganizations: Organization[]
    }
  | undefined
>(undefined)

export const MaintainerOrganizationContextProvider = ({
  organization,
  memberOrganizations,
  adminOrganizations,
  children,
}: {
  organization: Organization | undefined
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
      }}
    >
      {children}
    </MaintainerOrganizationContext.Provider>
  )
}
