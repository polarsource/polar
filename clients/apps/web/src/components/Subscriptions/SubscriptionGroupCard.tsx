'use client'

import { SubscriptionGroup } from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import { api } from 'polarkit'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from 'polarkit/components/ui/card'
import { getCentsInDollarString } from 'polarkit/money'
import React, { useMemo, useState } from 'react'
import SubscriptionGroupDialog from './SubscriptionGroupDialog'

interface SubscriptionGroupCardProps {
  subscriptionGroup: SubscriptionGroup
}

const SubscriptionGroupCard: React.FC<SubscriptionGroupCardProps> = ({
  subscriptionGroup,
}) => {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const firstTier = useMemo(
    () =>
      subscriptionGroup.tiers.length > 0 ? subscriptionGroup.tiers[0] : null,
    [subscriptionGroup],
  )

  const onDialogSubmit = async (data: any) => {
    await api.subscriptions.updateSubscriptionGroup({
      id: subscriptionGroup.id,
      subscriptionGroupUpdate: data,
    })
    setDialogOpen(false)
    router.refresh()
  }

  return (
    <Card
      key={subscriptionGroup.id}
      className="h-full border-0 bg-gradient-to-tr from-[#FAFBFF] to-[#F8F5FE] shadow-none dark:from-blue-900 dark:to-blue-950"
    >
      <CardHeader>
        <CardTitle
          className="cursor-pointer underline decoration-dotted"
          onClick={() => setDialogOpen(true)}
        >
          {subscriptionGroup.name}
        </CardTitle>
        <CardDescription>Deploy your new project in one-click.</CardDescription>
        {firstTier && (
          <div>
            {subscriptionGroup.tiers.length > 1 ? 'from' : ''}{' '}
            <span className="text-5xl">
              ${getCentsInDollarString(firstTier.price_amount, false, true)}
            </span>
          </div>
        )}
      </CardHeader>
      <SubscriptionGroupDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        subscriptionGroup={subscriptionGroup}
        onSubmit={onDialogSubmit}
      />
    </Card>
  )
}

export default SubscriptionGroupCard
