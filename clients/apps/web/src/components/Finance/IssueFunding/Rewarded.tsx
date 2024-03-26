'use client'

import Finance from '@/components/Finance/Finance'
import { Organization } from '@polar-sh/sdk'
import { useListPledgesForOrganization, useListRewards } from 'polarkit/hooks'

export default function ClientPage({
  organization,
}: {
  organization: Organization
}) {
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
          tab="rewarded"
        />
      ) : null}
    </>
  )
}
