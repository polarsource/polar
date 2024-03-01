'use client'

import { Organization } from '@polar-sh/sdk'
import React from 'react'

export const PublicPageOrganizationContext = React.createContext<
  Organization | undefined
>(undefined)

export const PublicPageOrganizationContextProvider = ({
  organization,
  children,
}: {
  organization: Organization
  children: React.ReactNode
}) => {
  return (
    <PublicPageOrganizationContext.Provider value={organization}>
      {children}
    </PublicPageOrganizationContext.Provider>
  )
}
