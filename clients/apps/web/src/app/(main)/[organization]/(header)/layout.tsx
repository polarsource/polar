import { PolarLogotype } from '@/components/Layout/Public/PolarLogotype'
import TopbarRight from '@/components/Layout/Public/TopbarRight'
import PublicLayout from '@/components/Layout/PublicLayout'
import { StorefrontNav } from '@/components/Organization/StorefrontNav'
import { StorefrontHeader } from '@/components/Profile/StorefrontHeader'
import { getServerSideAPI } from '@/utils/client/serverside'
import { getStorefrontOrNotFound } from '@/utils/storefront'
import { getAuthenticatedUser } from '@/utils/user'
import React from 'react'

export default async function Layout(props: {
  params: Promise<{ organization: string }>
  children: React.ReactNode
}) {
  const params = await props.params

  const { children } = props

  const api = await getServerSideAPI()

  const { organization } = await getStorefrontOrNotFound(
    api,
    params.organization,
  )

  const authenticatedUser = await getAuthenticatedUser()

  return (
    <PublicLayout className="gap-y-0 py-6 md:py-12" wide>
      <div className="relative flex flex-row items-center justify-end gap-x-6">
        <PolarLogotype
          className="absolute left-1/2 -translate-x-1/2"
          size={50}
        />

        <TopbarRight
          authenticatedUser={authenticatedUser}
          storefrontOrg={organization}
        />
      </div>
      <div className="flex flex-col gap-y-8">
        <div className="flex grow flex-col items-center">
          <StorefrontHeader organization={organization} />
        </div>
        <div className="flex flex-col items-center">
          <StorefrontNav organization={organization} />
        </div>
        <div className="flex h-full grow flex-col gap-y-8 md:gap-y-16 md:py-12">
          {children}
        </div>
      </div>
    </PublicLayout>
  )
}
