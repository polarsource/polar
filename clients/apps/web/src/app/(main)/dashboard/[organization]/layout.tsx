import { OrganizationContextProvider } from '@/providers/maintainerOrganization'
import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { getUserOrganizations } from '@/utils/user'
import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import React from 'react'

export async function generateMetadata(props: {
  params: Promise<{ organization: string }>
}): Promise<Metadata> {
  const params = await props.params
  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )
  return {
    title: {
      template: `%s | ${organization.name} | Polar`,
      default: organization.name,
    },
  }
}

export default async function Layout(props: {
  params: Promise<{ organization: string }>
  children: React.ReactNode
}) {
  const params = await props.params

  const { children } = props

  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )

  let userOrganizations = await getUserOrganizations(api, false)

  // If the organization is not in the user's organizations, refetch bypassing the cache
  // This avoids race conditions with new organizations (e.g. during onboarding) without losing
  // the cache in 99% of the cases
  if (!userOrganizations.some((org) => org.id === organization.id)) {
    userOrganizations = await getUserOrganizations(api, true)
  }

  // If we can't find the organization even after a refresh, redirect
  if (!userOrganizations.some((org) => org.id === organization.id)) {
    return redirect('/dashboard')
  }

  return (
    <OrganizationContextProvider
      organization={organization}
      organizations={userOrganizations}
    >
      {children}
    </OrganizationContextProvider>
  )
}
