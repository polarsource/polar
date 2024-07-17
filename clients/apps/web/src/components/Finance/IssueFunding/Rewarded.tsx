'use client'

import Finance from '@/components/Finance/Finance'
import { useListPledgesForOrganization, useListRewards } from '@/hooks/queries'
import { Organization } from '@polar-sh/sdk'

export default function ClientPage({
  organization,
}: {
  organization: Organization
}) {
  const pledges = useListPledgesForOrganization(
    organization.platform,
    organization.slug,
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
