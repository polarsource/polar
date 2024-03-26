'use client'

import Finance from '@/components/Finance/Finance'
import { useToast } from '@/components/Toast/use-toast'
import { Organization } from '@polar-sh/sdk'
import { useSearchParams } from 'next/navigation'
import { useListPledgesForOrganization, useListRewards } from 'polarkit/hooks'
import { useEffect } from 'react'

export default function Current({
  organization,
}: {
  organization: Organization
}) {
  const params = useSearchParams()
  const status = params?.get('status')
  const { toast } = useToast()

  useEffect(() => {
    if (status === 'stripe-connected') {
      toast({
        title: 'Stripe setup complete',
        description: 'Your account is now ready to accept pledges.',
      })
    }
  }, [status, toast])

  const pledges = useListPledgesForOrganization(
    organization.platform,
    organization.name,
  )
  const rewards = useListRewards(organization.id)

  return (
    <>
      {pledges.data?.items && rewards.data?.items ? (
        <Finance
          pledges={pledges.data.items}
          rewards={rewards.data.items}
          org={organization}
          tab="current"
        />
      ) : null}
    </>
  )
}
