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
}

export const OrganizationContext =
  // @ts-expect-error because of stub
  React.createContext<OrganizationContextType>(stub)

export const OrganizationContextProvider = ({
  organization,
  organizations,
  children,
}: {
  organization: schemas['Organization']
  organizations: schemas['Organization'][]
  children: React.ReactNode
}) => {
  const value = useMemo(
    () => ({
      organization,
      organizations,
    }),
    [organization, organizations],
  )

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  )
}
