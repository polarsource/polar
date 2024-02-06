import { getServerSideAPI } from '@/utils/api'
import { ListResourceOrganization, UserRead } from '@polar-sh/sdk'
import { notFound } from 'next/navigation'
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
  let authenticatedUser: UserRead | undefined

  try {
    const [loadOrganizations, loadAuthenticatedUser] = await Promise.all([
      api.organizations.list({}, { cache: 'no-store' }),
      // Handle unauthenticated
      api.users.getAuthenticated({ cache: 'no-store' }),
    ])

    organizations = loadOrganizations
    authenticatedUser = loadAuthenticatedUser
  } catch (e) {
    notFound()
  }

  if (!organizations) {
    notFound()
  }

  // User does not have access to organization
  const org = (organizations.items ?? []).find(
    (o) => o.name === params.organization,
  )

  if (!org) {
    return notFound()
  }

  return <>{children}</>
}
