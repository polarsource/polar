'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import {
  Organization,
  SubscriptionGroup,
  SubscriptionTier,
  SubscriptionTierUpdate,
} from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import { api } from 'polarkit'
import { Button } from 'polarkit/components/ui/button'
import { Form } from 'polarkit/components/ui/form'
import React, { useCallback } from 'react'
import { useForm } from 'react-hook-form'
import SubscriptionTierCard from './SubscriptionTierCard'
import SubscriptionTierForm from './SubscriptionTierForm'

interface SubscriptionTierEditPageProps {
  subscriptionTier: SubscriptionTier
  subscriptionGroup: SubscriptionGroup
  organization: Organization
}

const SubscriptionTierEditPage: React.FC<SubscriptionTierEditPageProps> = ({
  subscriptionTier,
  subscriptionGroup,
  organization,
}) => {
  const router = useRouter()

  const form = useForm<SubscriptionTierUpdate>({
    defaultValues: subscriptionTier,
  })
  const { handleSubmit, watch } = form

  const editingSubscriptionTier = watch() as SubscriptionTier

  const onSubmit = useCallback(
    async (subscriptionTierUpdate: SubscriptionTierUpdate) => {
      await api.subscriptions.updateSubscriptionTier({
        id: subscriptionTier.id,
        subscriptionTierUpdate,
      })
      router.push(`/maintainer/${organization.name}/subscriptions/tiers`)
      router.refresh()
    },
    [router, organization, subscriptionTier],
  )

  return (
    <DashboardBody>
      <Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="mb-8 flex items-center justify-between">
            <h1 className="text-lg font-medium">New Subscription Tier</h1>
            <div className="flex flex-row gap-2">
              <Button variant="ghost" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" variant="default">
                Save Tier
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-4">
            <div className="col-span-2 space-y-6">
              <SubscriptionTierForm update={true} subscriptionGroups={[]} />
            </div>
            <div className="col-start-4">
              <SubscriptionTierCard
                subscriptionGroup={subscriptionGroup}
                subscriptionTier={editingSubscriptionTier}
              />
            </div>
          </div>
        </form>
      </Form>
    </DashboardBody>
  )
}

export default SubscriptionTierEditPage
