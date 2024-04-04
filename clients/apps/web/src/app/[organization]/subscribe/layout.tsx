import { PublicPageOrganizationContextProvider } from '@/providers/organization'
import { getServerSideAPI } from '@/utils/api'
import { Organization, Platforms } from '@polar-sh/sdk'
import { notFound } from 'next/navigation'
import React from 'react'

const cacheConfig = {
  next: {
    revalidate: 30, // 30 seconds
  },
}

export default async function Layout({
  params,
  children,
}: {
  params: { organization: string }
  children: React.ReactNode
}) {
  const api = getServerSideAPI()

  let organization: Organization | undefined

  try {
    const [loadOrganization] = await Promise.all([
      api.organizations.lookup(
        {
          platform: Platforms.GITHUB,
          organizationName: params.organization,
        },
        cacheConfig,
      ),
    ])

    organization = loadOrganization
  } catch (e) {
    notFound()
  }

  if (!organization) {
    notFound()
  }

  return (
    <PublicPageOrganizationContextProvider organization={organization}>
      <div className="flex flex-col">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col items-start px-4 md:h-full md:flex-row md:gap-16 md:space-y-8 md:px-24 lg:gap-32">
          {children}
        </div>
      </div>
    </PublicPageOrganizationContextProvider>
  )
}
