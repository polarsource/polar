'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import EmptyLayout from '@/components/Layout/EmptyLayout'
import SubscriptionGroupCard from '@/components/Subscriptions/SubscriptionGroupCard'
import { PlusCircleIcon } from '@heroicons/react/24/outline'
import { Bolt } from '@mui/icons-material'
import { ListResourceSubscriptionGroup } from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import { api } from 'polarkit'
import { Button } from 'polarkit/components/ui/button'
import { Checkbox } from 'polarkit/components/ui/checkbox'
import { useState } from 'react'
import SubscriptionGroupDialog from './SubscriptionGroupDialog'
import SubscriptionGroupTiers from './SubscriptionGroupTiers'

interface TiersPageProps {
  subscriptionGroups: ListResourceSubscriptionGroup
  organizationId: string
}

const TiersPage: React.FC<TiersPageProps> = ({
  subscriptionGroups,
  organizationId,
}) => {
  const router = useRouter()
  const [addGroupDialogOpen, setAddGroupDialogOpen] = useState(false)

  const onAddGroupDialogSubmit = async (data: any) => {
    await api.subscriptions.createSubscriptionGroup({
      subscriptionGroupCreate: {
        ...data,
        order:
          subscriptionGroups.items && subscriptionGroups.items.length > 0
            ? subscriptionGroups.items[subscriptionGroups.items.length - 1]
                .order + 1
            : 1,
        organization_id: organizationId,
      },
    })
    setAddGroupDialogOpen(false)
    router.refresh()
  }

  return (
    <DashboardBody>
      {subscriptionGroups.pagination.total_count === 0 && (
        <EmptyLayout>
          <div className="dark:text-polar-500 flex flex-col items-center justify-center space-y-6 py-[20%] text-gray-400">
            <span className="text-6xl">
              <Bolt fontSize="inherit" />
            </span>
            <h2 className="text-lg">
              You haven&apos;t created any subscription tiers
            </h2>
            <Button
              variant="outline"
              onClick={() => setAddGroupDialogOpen(true)}
            >
              Create one now
            </Button>
          </div>
        </EmptyLayout>
      )}
      {subscriptionGroups.pagination.total_count > 0 && (
        <div className="grid auto-cols-[300px] grid-flow-col gap-4">
          {/* Leftmost col */}
          <div className="grid grid-rows-[150px_repeat(auto-fill,_25px)] gap-y-4">
            <div>{/* Top-left cell */}</div>
            <div>{/* Tiers cell */}</div>
            {[1, 2, 3, 4, 5].map((i) => (
              <div className="flex items-center">Benefit {i}</div>
            ))}
          </div>
          {/* Subscription groups cols */}
          {subscriptionGroups.items?.map((subscriptionGroup) => (
            <div
              key={subscriptionGroup.id}
              className="grid grid-rows-[150px_repeat(auto-fill,_25px)]  gap-y-4"
              style={{
                gridTemplateColumns: `repeat(${
                  subscriptionGroup.tiers.length + 1
                }, minmax(auto-fill, 1fr))`,
              }}
            >
              <div
                style={{
                  gridColumn: `span ${
                    subscriptionGroup.tiers.length + 1
                  } / span ${subscriptionGroup.tiers.length + 1}`,
                }}
              >
                <SubscriptionGroupCard subscriptionGroup={subscriptionGroup} />
              </div>
              <SubscriptionGroupTiers subscriptionGroup={subscriptionGroup} />
              {/* Fake checkboxes to preview the future */}
              {[1, 2, 3, 4, 5].map((i) => (
                <>
                  {subscriptionGroup.tiers.map((tier) => (
                    <div
                      key={`${tier.id}-${i}`}
                      className="flex items-center justify-center"
                    >
                      <Checkbox />
                    </div>
                  ))}
                  <div>{/* Plus col */}</div>
                </>
              ))}
            </div>
          ))}
          {/* Add subscription group col */}
          <div
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-8 border-dashed opacity-70 hover:opacity-100"
            onClick={() => setAddGroupDialogOpen(true)}
          >
            <PlusCircleIcon className="h-12 w-12"></PlusCircleIcon>
            <div>Add tiers group</div>
          </div>
          {/* Margin fix col */}
          <div className="w-1"></div>
        </div>
      )}
      <SubscriptionGroupDialog
        open={addGroupDialogOpen}
        onOpenChange={setAddGroupDialogOpen}
        onSubmit={onAddGroupDialogSubmit}
      />
    </DashboardBody>
  )
}

export default TiersPage
