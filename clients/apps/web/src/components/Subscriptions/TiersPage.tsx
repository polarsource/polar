'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { Bolt } from '@mui/icons-material'
import { Organization, SubscriptionTierType } from '@polar-sh/sdk'
import Link from 'next/link'
import { Button } from 'polarkit/components/ui/atoms'
import { useSubscriptionTiers } from 'polarkit/hooks'
import React, { useMemo } from 'react'
import EmptyLayout from '../Layout/EmptyLayout'
import FreeSubscriptionGroup from './FreeSubscriptionGroup'
import SubscriptionGroup from './SubscriptionGroup'
import { getSubscriptionTiersByType } from './utils'

interface TiersPageProps {
  organization: Organization
}

const TiersPage: React.FC<TiersPageProps> = ({ organization }) => {
  const subscriptionTiers = useSubscriptionTiers(organization.name)

  const subscriptionTiersByType = useMemo(
    () => getSubscriptionTiersByType(subscriptionTiers.data?.items ?? []),
    [subscriptionTiers.data],
  )

  if (!subscriptionTiers.data?.items?.length) {
    return (
      <EmptyLayout>
        <div className="dark:text-polar-600 flex flex-col items-center justify-center space-y-10 py-96 text-gray-400">
          <span className="text-6xl text-blue-400">
            <Bolt fontSize="inherit" />
          </span>
          <h2 className="text-lg">
            You haven&apos;t configured any subscription tiers
          </h2>
          <Link
            href={`/maintainer/${organization.name}/subscriptions/tiers/new`}
          >
            <Button variant="secondary">Create Subscription Tier</Button>
          </Link>
        </div>
      </EmptyLayout>
    )
  }

  return (
    <DashboardBody>
      <FreeSubscriptionGroup
        title="Free"
        description="Built-in free tier so people can follow your news on Polar"
        tier={subscriptionTiersByType.free[0]}
        organization={organization}
      />
      <div className="dark:divide-polar-700 flex flex-col gap-4 divide-y">
        <SubscriptionGroup
          title="Hobby"
          description="Tiers for individuals & fans who want to say thanks"
          type={SubscriptionTierType.HOBBY}
          tiers={subscriptionTiersByType.hobby}
          organization={organization}
        />
        <SubscriptionGroup
          title="Pro"
          description="Tiers best suited for indie hackers & startups"
          type={SubscriptionTierType.PRO}
          tiers={subscriptionTiersByType?.pro}
          organization={organization}
        />
        <SubscriptionGroup
          title="Business"
          description="Your most exclusive tiers for business customers"
          type={SubscriptionTierType.BUSINESS}
          tiers={subscriptionTiersByType?.business}
          organization={organization}
        />
      </div>
    </DashboardBody>
  )
}

export default TiersPage
