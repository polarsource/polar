'use client'

import Finance from '@/components/Finance/Finance'
import Head from 'next/head'
import { useRouter } from 'next/navigation'
import {
  useListAccountsByOrganization,
  useListPledgesForOrganization,
  useListRewards,
} from 'polarkit/hooks'
import { useEffect } from 'react'
import { useCurrentOrgAndRepoFromURL } from '../../../../../hooks'

export default function Page() {
  const router = useRouter()
  const { org, isLoaded } = useCurrentOrgAndRepoFromURL()

  useEffect(() => {
    if (isLoaded && !org) {
      router.push('/feed')
      return
    }
  }, [isLoaded, org, router])

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
          tab="rewarded"
          accounts={accounts.data?.items || []}
        />
      )}
    </>
  )
}
