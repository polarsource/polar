'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import {
  Organization,
  SubscriptionGroup,
  SubscriptionTier,
  SubscriptionTierCreate,
} from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import { api } from 'polarkit'
import { Button } from 'polarkit/components/ui/button'
import { Form } from 'polarkit/components/ui/form'
import React, { useCallback, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import SubscriptionTierCard from './SubscriptionTierCard'
import SubscriptionTierForm from './SubscriptionTierForm'

interface SubscriptionTierCreatePageProps {
  subscriptionGroups: SubscriptionGroup[]
  subscriptionGroup?: string
  organization: Organization
}

const SubscriptionTierCreatePage: React.FC<SubscriptionTierCreatePageProps> = ({
  subscriptionGroups,
  subscriptionGroup,
  organization,
}) => {
  const router = useRouter()

  const form = useForm<SubscriptionTierCreate>({
    defaultValues: {
      ...(subscriptionGroup
        ? { subscription_group_id: subscriptionGroup }
        : {}),
    },
  })
  const { handleSubmit, watch } = form

  const newSubscriptionTier = watch() as SubscriptionTier

  const selectedSubscriptionGroupId = watch('subscription_group_id')
  const selectedSubscriptionGroup = useMemo(() => {
    if (selectedSubscriptionGroupId) {
      return subscriptionGroups.find(
        ({ id }) => id === selectedSubscriptionGroupId,
      )
    }
  }, [subscriptionGroups, selectedSubscriptionGroupId])

  const onSubmit = useCallback(
    async (subscriptionTierCreate: SubscriptionTierCreate) => {
      await api.subscriptions.createSubscriptionTier({
        subscriptionTierCreate,
      })
      router.push(`/maintainer/${organization.name}/subscriptions/tiers`)
      router.refresh()
    },
    [router, organization],
  )

  return (
    <DashboardBody>
      <Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="mb-16 flex items-center justify-between">
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
              <SubscriptionTierForm
                update={false}
                subscriptionGroups={subscriptionGroups}
              />
            </div>
            <div className="col-start-4">
              {selectedSubscriptionGroup && (
                <SubscriptionTierCard
                  subscriptionGroup={selectedSubscriptionGroup}
                  subscriptionTier={newSubscriptionTier}
                />
              )}
            </div>
          </div>
        </form>
      </Form>
    </DashboardBody>
  )
}

export default SubscriptionTierCreatePage
