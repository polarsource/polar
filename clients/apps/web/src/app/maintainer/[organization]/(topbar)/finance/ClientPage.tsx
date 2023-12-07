'use client'

import Finance from '@/components/Finance/Finance'
import { useToast } from '@/components/Toast/use-toast'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  useListPledgesForOrganization,
  useListRewards,
  useOrganizationAccount,
} from 'polarkit/hooks'
import { useEffect } from 'react'
import { useCurrentOrgAndRepoFromURL } from '../../../../../hooks'

export default function ClientPage() {
  const router = useRouter()
  const { org, isLoaded } = useCurrentOrgAndRepoFromURL()

  const params = useSearchParams()
  const status = params?.get('status')

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
  const { data: account } = useOrganizationAccount(org?.id)

  return (
    <>
      {org && pledges.data?.items && rewards.data?.items && (
        <Finance
          pledges={pledges.data.items}
          rewards={rewards.data.items}
          org={org}
          tab="current"
          account={account}
        />
      )}
    </>
  )
}
