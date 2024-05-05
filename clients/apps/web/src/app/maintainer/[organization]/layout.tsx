import { shouldBeOnboarded } from '@/hooks/onboarding'
import { MaintainerOrganizationContextProvider } from '@/providers/maintainerOrganization'
import { getServerSideAPI } from '@/utils/api/serverside'
import { ListResourceOrganization } from '@polar-sh/sdk'
import { notFound, redirect } from 'next/navigation'
import React from 'react'

export default async function Layout({
  params,
  children,
}: {
  params: { organization: string }
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

  // User does not have access to organization
  const org = orgs.find((o) => o.name === params.organization)

  const personalOrganization = orgs.find((o) => o.is_personal)

  if (!org) {
    return notFound()
  }

  if (shouldBeOnboarded(org)) {
    return redirect(`/maintainer/${org.name}/onboarding`)
  }

  return (
    <MaintainerOrganizationContextProvider
      organization={org}
      memberOrganizations={orgs}
      adminOrganizations={adminOrgs}
      personalOrganization={personalOrganization}
    >
      {children}
    </MaintainerOrganizationContextProvider>
  )
}
