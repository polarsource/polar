'use client'

import { schemas } from '@polar-sh/client'
import React, { useMemo } from 'react'

const stub = (): never => {
  throw new Error(
    'You forgot to wrap your component in <OrganizationContextProvider>.',
  )
}

interface OrganizationContextType {
  organization: schemas['Organization']
  organizations: schemas['Organization'][]
  memberOrganizations: schemas['MemberOrganization'][]
}

export const OrganizationContext =
  // @ts-expect-error because of stub
  React.createContext<OrganizationContextType>(stub)

export const OrganizationContextProvider = ({
  organization,
  organizations,
  memberOrganizations,
  children,
}: {
  organization: schemas['Organization']
  organizations: schemas['Organization'][]
  memberOrganizations: schemas['MemberOrganization'][]
  children: React.ReactNode
}) => {
  const value = useMemo(
    () => ({
      organization,
      organizations,
      memberOrganizations,
    }),
    [organization, organizations, memberOrganizations],
  )

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  )
}
