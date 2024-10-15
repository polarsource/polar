import { BrandingMenu } from '@/components/Layout/Public/BrandingMenu'
import TopbarRight from '@/components/Layout/Public/TopbarRight'
import PublicLayout from '@/components/Layout/PublicLayout'
import { getServerSideAPI } from '@/utils/api/serverside'
import { UserRead } from '@polar-sh/sdk'
import React from 'react'

export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  const api = getServerSideAPI()

  let authenticatedUser: UserRead | undefined

  try {
    authenticatedUser = await api.users.getAuthenticated()
  } catch (e) {}

  return (
    <PublicLayout className="gap-y-0 py-6 md:py-12" wide footer={false}>
      <div className="relative flex flex-row items-center justify-end gap-x-6">
        <BrandingMenu
          className="absolute left-1/2 -translate-x-1/2"
          size={50}
        />

        <TopbarRight authenticatedUser={authenticatedUser} />
      </div>
      {children}
    </PublicLayout>
  )
}
