import { Metadata } from 'next'

import { Toaster } from '@/components/Toast/Toaster'
import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationOrNotFound } from '@/utils/customerPortal'
import { CustomerPortalLayoutWrapper } from './CustomerPortalLayoutWrapper'

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

export const dynamic = 'force-dynamic'

export default async function Layout(props: {
  params: Promise<{ organization: string }>
  children: React.ReactNode
}) {
  const params = await props.params

  const { children } = props

  const api = await getServerSideAPI()
  const { organization } = await getOrganizationOrNotFound(
    api,
    params.organization,
  )

  return (
    <div className="flex min-h-screen grow flex-col">
      <CustomerPortalLayoutWrapper organization={organization}>
        {children}
      </CustomerPortalLayoutWrapper>
      <Toaster />
    </div>
  )
}
