import { MaintainerOrganizationContextProvider } from '@/providers/maintainerOrganization'
import { getServerSideAPI } from '@/utils/api'
import { ListResourceOrganization } from '@polar-sh/sdk'
import { notFound } from 'next/navigation'
import React from 'react'

export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  const api = getServerSideAPI()

  let organizations: ListResourceOrganization | undefined
  let adminOrganizations: ListResourceOrganization | undefined

  try {
    const [loadOrganizations, loadAdminOrganizations] = await Promise.all([
      api.organizations.list({}, { cache: 'no-store' }),
      api.organizations.list({ isAdminOnly: true }, { cache: 'no-store' }),
    ])

    organizations = loadOrganizations
    adminOrganizations = loadAdminOrganizations
  } catch (e) {
    notFound()
  }

  if (!organizations) {
    notFound()
  }

  const orgs = organizations.items ?? []
  const adminOrgs = adminOrganizations.items ?? []
  const personalOrganization = orgs.find((o) => o.is_personal)

  return (
    <MaintainerOrganizationContextProvider
      organization={undefined}
      memberOrganizations={orgs}
      adminOrganizations={adminOrgs}
      personalOrganization={personalOrganization}
    >
      {children}
    </MaintainerOrganizationContextProvider>
  )
}
