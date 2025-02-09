'use client'

import Finance from '@/components/Finance/Finance'
import { useListPledgesForOrganization, useListRewards } from '@/hooks/queries'
import { components } from '@polar-sh/client'

export default function ClientPage({
  organization,
}: {
  organization: components['schemas']['Organization']
}) {
  const pledges = useListPledgesForOrganization(organization.id)
  const rewards = useListRewards(organization.id)

  return (
    <>
      {pledges.data?.items && rewards.data?.items ? (
        <Finance
          pledges={pledges.data.items}
          rewards={rewards.data.items}
          org={organization}
          tab="contributors"
        />
      ) : null}
    </>
  )
}
