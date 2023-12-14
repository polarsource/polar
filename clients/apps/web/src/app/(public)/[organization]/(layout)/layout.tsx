import EmptyLayout from '@/components/Layout/EmptyLayout'
import PageNotFound from '@/components/Shared/PageNotFound'
import { getServerSideAPI } from '@/utils/api'
import { Platforms } from '@polar-sh/sdk'
import React from 'react'
import ClientLayout from './ClientLayout'

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

  const [organization] = await Promise.all([
    api.organizations.lookup(
      {
        platform: Platforms.GITHUB,
        organizationName: params.organization,
      },
      cacheConfig,
    ),
  ])

  if (organization === undefined) {
    return <PageNotFound />
  }

  return (
    <EmptyLayout>
      <ClientLayout organization={organization}>{children}</ClientLayout>
    </EmptyLayout>
  )
}
