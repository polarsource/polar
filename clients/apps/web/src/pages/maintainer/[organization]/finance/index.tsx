import Gatekeeper from '@/components/Dashboard/Gatekeeper/Gatekeeper'
import Finance from '@/components/Finance/Finance'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import { useToast } from '@/components/Toast/use-toast'
import type { NextLayoutComponentType } from 'next'
import Head from 'next/head'
import { useRouter } from 'next/router'
import {
  useListAccountsByOrganization,
  useListPledgesForOrganization,
  useListRewards,
} from 'polarkit/hooks'
import { ReactElement, useEffect } from 'react'
import { useCurrentOrgAndRepoFromURL } from '../../../../hooks'

const Page: NextLayoutComponentType = () => {
  const router = useRouter()
  const { org, isLoaded } = useCurrentOrgAndRepoFromURL()
  const { status } = router.query
  const { toast } = useToast()

  useEffect(() => {
    if (isLoaded && !org) {
      router.push('/feed')
      return
    }
  }, [isLoaded, org, router])

  useEffect(() => {
    if (status === 'stripe-connected') {
      toast({
        title: 'Stripe setup complete',
        description: 'Your account is now ready to accept pledges.',
      })
    }
  }, [status, toast])

  const pledges = useListPledgesForOrganization(org?.platform, org?.name)
  const rewards = useListRewards(org?.id)
  const accounts = useListAccountsByOrganization(org?.id)

  return (
    <>
      <Head>
        <title>Polar{org ? ` ${org.name}` : ''}</title>
      </Head>
      {org && pledges.data?.items && rewards.data?.items && (
        <Finance
          pledges={pledges.data.items}
          rewards={rewards.data.items}
          org={org}
          tab="current"
          accounts={accounts.data?.items || []}
        />
      )}
    </>
  )
}

Page.getLayout = (page: ReactElement) => {
  return (
    <Gatekeeper>
      <DashboardLayout showSidebar={true}>{page}</DashboardLayout>
    </Gatekeeper>
  )
}

export default Page
