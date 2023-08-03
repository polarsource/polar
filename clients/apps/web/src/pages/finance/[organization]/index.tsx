import Gatekeeper from '@/components/Dashboard/Gatekeeper/Gatekeeper'
import Finance from '@/components/Finance/Finance'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import type { NextLayoutComponentType } from 'next'
import Head from 'next/head'
import { useRouter } from 'next/router'
import {
  useListPledgesForOrganization,
  useOrganizationAccounts,
} from 'polarkit/hooks'
import { ReactElement, useEffect } from 'react'
import { useCurrentOrgAndRepoFromURL } from '../../../hooks'

const Page: NextLayoutComponentType = () => {
  const router = useRouter()
  const { org, isLoaded } = useCurrentOrgAndRepoFromURL()

  useEffect(() => {
    if (isLoaded && !org) {
      router.push('/dashboard')
      return
    }
  }, [isLoaded, org, router])

  const pledges = useListPledgesForOrganization(org?.platform, org?.name)

  const accounts = useOrganizationAccounts(org?.name)

  return (
    <>
      <Head>
        <title>Polar{org ? ` ${org.name}` : ''}</title>
      </Head>
      {org && pledges.data && accounts.data && (
        <Finance
          pledges={pledges.data}
          org={org}
          tab="current"
          accounts={accounts.data}
        />
      )}
    </>
  )
}

Page.getLayout = (page: ReactElement) => {
  return (
    <Gatekeeper>
      <DashboardLayout>{page}</DashboardLayout>
    </Gatekeeper>
  )
}

export default Page
