import { BrandingMenu } from '@/components/Layout/Public/BrandingMenu'
import TopbarRight from '@/components/Layout/Public/TopbarRight'
import PublicLayout from '@/components/Layout/PublicLayout'
import { StorefrontNav } from '@/components/Organization/StorefrontNav'
import { StorefrontHeader } from '@/components/Profile/StorefrontHeader'
import { getServerSideAPI } from '@/utils/api/serverside'
import { getStorefrontOrNotFound } from '@/utils/storefront'
import { UserRead } from '@polar-sh/sdk'
import React from 'react'

export default async function Layout({
  params,
  children,
}: {
  params: { organization: string }
  children: React.ReactNode
}) {
  const api = getServerSideAPI()

  const { organization } = await getStorefrontOrNotFound(
    api,
    params.organization,
  )

  let authenticatedUser: UserRead | undefined

  try {
    authenticatedUser = await api.users.getAuthenticated()
  } catch (e) {}

  return (
    <PublicLayout className="gap-y-0 py-6 md:py-12" wide>
      <div className="relative flex flex-row items-center justify-end gap-x-6">
        <BrandingMenu
          className="absolute left-1/2 -translate-x-1/2"
          size={50}
        />

        <TopbarRight
          authenticatedUser={authenticatedUser}
          storefrontOrg={organization}
        />
      </div>
      <div className="flex flex-col gap-y-8">
        <div className="flex flex-grow flex-col items-center">
          <StorefrontHeader organization={organization} />
        </div>
        <div className="flex flex-col items-center">
          <StorefrontNav organization={organization} />
        </div>
        <div className="flex h-full flex-grow flex-col gap-y-8 md:gap-y-16 md:py-12">
          {children}
        </div>
      </div>
    </PublicLayout>
  )
}
