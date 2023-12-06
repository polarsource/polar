'use client'

import Finance from '@/components/Finance/Finance'
import { useCurrentOrgAndRepoFromURL } from '@/hooks/org'
import { useRouter } from 'next/navigation'
import {
  useListAccountsByOrganization,
  useListPledgesForOrganization,
  useListRewards,
} from 'polarkit/hooks'
import { useEffect } from 'react'

export default function ClientPage() {
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
      {org && pledges.data?.items && rewards.data?.items && (
        <Finance
          pledges={pledges.data.items}
          rewards={rewards.data.items}
          org={org}
          tab="contributors"
          accounts={accounts.data?.items || []}
        />
      )}
    </>
  )
}
