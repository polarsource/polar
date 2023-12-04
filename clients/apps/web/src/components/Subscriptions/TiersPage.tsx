'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { Add, Bolt } from '@mui/icons-material'
import { Organization } from '@polar-sh/sdk'
import Link from 'next/link'
import { Button } from 'polarkit/components/ui/atoms'
import { useSubscriptionTiers } from 'polarkit/hooks'
import React, { useMemo } from 'react'
import EmptyLayout from '../Layout/EmptyLayout'
import SubscriptionTierCard from './SubscriptionTierCard'
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

  const tiers = useMemo(
    () => [
      ...subscriptionTiersByType.free,
      ...subscriptionTiersByType.hobby,
      ...subscriptionTiersByType.pro,
      ...subscriptionTiersByType.business,
    ],
    [subscriptionTiers.data?.items],
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
      <div className="dark:bg-polar-900 dark:border-polar-800 flex flex-col gap-y-12 rounded-3xl border border-gray-100 bg-white p-10 shadow-sm">
        <div className="flex flex-row justify-between">
          <div className="flex flex-col gap-y-2">
            <h2 className="text-lg font-medium">Subscription Tiers</h2>
            <p className="dark:text-polar-500 text-sm text-gray-500">
              Manage your subscription tiers & benefits
            </p>
          </div>
          <div>
            <Link
              href={{
                pathname: `/maintainer/${organization.name}/subscriptions/tiers/new`,
              }}
            >
              <Button>
                <Add className="mr-2" fontSize="small" />
                New Tier
              </Button>
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-10">
          {tiers.map((tier) => (
            <SubscriptionTierCard
              className="h-full"
              key={tier.id}
              subscriptionTier={tier}
            >
              <Link
                key={tier.id}
                href={`/maintainer/${organization.name}/subscriptions/tiers/${tier.id}`}
                className="w-full"
              >
                <Button variant="outline" fullWidth>
                  Edit Tier
                </Button>
              </Link>
            </SubscriptionTierCard>
          ))}
        </div>
      </div>
    </DashboardBody>
  )
}

export default TiersPage
