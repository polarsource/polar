import { shouldBeOnboarded } from '@/hooks/onboarding'
import { MaintainerOrganizationContextProvider } from '@/providers/maintainerOrganization'
import { getServerSideAPI } from '@/utils/api/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { getUserOrganizations } from '@/utils/user'
import { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import React from 'react'

export async function generateMetadata({
  params,
}: {
  params: { organization: string }
}): Promise<Metadata> {
  const organization = await getOrganizationBySlugOrNotFound(
    getServerSideAPI(),
    params.organization,
  )
  return {
    title: {
      template: `%s | ${organization.name} | Polar`,
      default: organization.name,
    },
  }
}

export default async function Layout({
  params,
  children,
}: {
  params: { organization: string }
  children: React.ReactNode
}) {
  const api = getServerSideAPI()
  const organizationsListResult = await api.organizations.list(
    {
      slug: params.organization,
      isMember: true,
    },
    { cache: 'no-store' },
  )
  const organization = organizationsListResult.items?.[0]

  if (!organization) {
    notFound()
  }

  if (shouldBeOnboarded(organization)) {
    return redirect(`/maintainer/${organization.slug}/onboarding`)
  }

  const userOrganizations = await getUserOrganizations(api)

  return (
    <MaintainerOrganizationContextProvider
      organization={organization}
      organizations={userOrganizations}
    >
      {children}
    </MaintainerOrganizationContextProvider>
  )
}
