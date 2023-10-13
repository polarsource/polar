'use client'

import { PlusCircleIcon } from '@heroicons/react/24/outline'
import { SubscriptionGroup, SubscriptionTier } from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import { api } from 'polarkit'
import { Separator } from 'polarkit/components/ui/separator'
import { getCentsInDollarString } from 'polarkit/money'
import React, { useState } from 'react'
import SubscriptionTierDialog from './SubscriptionTierDialog'

interface SubscriptionGroupTiersProps {
  subscriptionGroup: SubscriptionGroup
}

const SubscriptionGroupTiers: React.FC<SubscriptionGroupTiersProps> = ({
  subscriptionGroup,
}) => {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedTier, setSelectedTier] = useState<
    SubscriptionTier | undefined
  >()

  const openDialog = (subscriptionTier?: SubscriptionTier) => {
    setSelectedTier(subscriptionTier)
    setDialogOpen(true)
  }

  const onTierDialogSubmit = async (data: any) => {
    if (selectedTier) {
      await api.subscriptions.updateSubscriptionTier({
        id: selectedTier.id,
        subscriptionTierUpdate: data,
      })
    } else {
      await api.subscriptions.createSubscriptionTier({
        subscriptionTierCreate: {
          ...data,
          subscription_group_id: subscriptionGroup.id,
        },
      })
    }
    setDialogOpen(false)
    router.refresh()
  }

  return (
    <>
      {subscriptionGroup.tiers.map((tier) => (
        <div key={tier.id} className="flex items-center justify-center">
          <div
            className="flex grow cursor-pointer justify-center underline decoration-dotted"
            onClick={() => openDialog(tier)}
          >
            ${getCentsInDollarString(tier.price_amount, false, true)}
          </div>
          <Separator orientation="vertical" />
        </div>
      ))}
      <div className="flex h-full w-full items-center justify-center">
        <PlusCircleIcon
          className="h-6 w-6 cursor-pointer opacity-70 hover:opacity-100"
          aria-label="Add tier"
          onClick={() => openDialog()}
        />
      </div>
      <SubscriptionTierDialog
        subscriptionTier={selectedTier}
        open={dialogOpen}
        onOpenChange={(open) => setDialogOpen(open)}
        onSubmit={onTierDialogSubmit}
      />
    </>
  )
}

export default SubscriptionGroupTiers
