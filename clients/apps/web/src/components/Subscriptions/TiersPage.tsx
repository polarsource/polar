'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import EmptyLayout from '@/components/Layout/EmptyLayout'
import { Bolt } from '@mui/icons-material'
import { ListResourceSubscriptionGroup, Organization } from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import { api } from 'polarkit'
import { Button } from 'polarkit/components/ui/button'
import React, { useCallback } from 'react'
import SubscriptionGroup from './SubscriptionGroup'

interface TiersPageProps {
  subscriptionGroups: ListResourceSubscriptionGroup
  organization: Organization
}

const TiersPage: React.FC<TiersPageProps> = ({
  subscriptionGroups,
  organization,
}) => {
  const router = useRouter()

  const initializeGroups = useCallback(async () => {
    await api.subscriptions.initializeSubscriptionGroups({
      subscriptionGroupInitialize: { organization_id: organization.id },
    })

    router.refresh()
  }, [organization, router])

  return (
    <DashboardBody>
      {subscriptionGroups.pagination.total_count === 0 && (
        <EmptyLayout>
          <div className="dark:text-polar-500 flex flex-col items-center justify-center space-y-6 py-[20%] text-gray-400">
            <span className="text-6xl">
              <Bolt fontSize="inherit" />
            </span>
            <h2 className="text-lg">
              Your subscription tiers are not set up... Yet!
            </h2>
            <Button variant="outline" onClick={initializeGroups}>
              Initialize subscription tiers
            </Button>
          </div>
        </EmptyLayout>
      )}
      {subscriptionGroups.pagination.total_count > 0 && (
        <div className="dark:divide-polar-700 flex flex-col gap-4 divide-y">
          {subscriptionGroups.items?.map((subscriptionGroup) => (
            <React.Fragment key={subscriptionGroup.id}>
              <SubscriptionGroup
                subscriptionGroup={subscriptionGroup}
                organization={organization}
              />
            </React.Fragment>
          ))}
        </div>
      )}
    </DashboardBody>
  )
}

export default TiersPage
