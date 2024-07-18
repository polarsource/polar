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

  let userOrganizations: ListResourceOrganization | undefined

  try {
    const loadUserOrganizations = await api.organizations.list(
      { isMember: true },
      { cache: 'no-store' },
    )
    userOrganizations = loadUserOrganizations
  } catch (e) {
    notFound()
  }

  if (!userOrganizations) {
    notFound()
  }

  const orgs = userOrganizations.items ?? []

  // User does not have access to organization
  const org = orgs.find((o) => o.slug === params.organization)

  if (!org) {
    return notFound()
  }

  if (shouldBeOnboarded(org)) {
    return redirect(`/maintainer/${org.slug}/onboarding`)
  }

  return (
    <MaintainerOrganizationContextProvider
      organization={org}
      organizations={orgs}
    >
      {children}
    </MaintainerOrganizationContextProvider>
  )
}
