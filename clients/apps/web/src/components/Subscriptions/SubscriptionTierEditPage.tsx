'use client'

import { DashboardBody } from '@/components/Layout/MaintainerLayout'
import {
  Organization,
  SubscriptionTier,
  SubscriptionTierUpdate,
} from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import { api } from 'polarkit'
import { Button } from 'polarkit/components/ui/atoms'
import { Form } from 'polarkit/components/ui/form'
import React, { useCallback } from 'react'
import { useForm } from 'react-hook-form'
import SubscriptionTierCard from './SubscriptionTierCard'
import SubscriptionTierForm from './SubscriptionTierForm'

interface SubscriptionTierEditPageProps {
  subscriptionTier: SubscriptionTier
  organization: Organization
}

const SubscriptionTierEditPage: React.FC<SubscriptionTierEditPageProps> = ({
  subscriptionTier,
  organization,
}) => {
  const router = useRouter()

  const form = useForm<SubscriptionTierUpdate>({
    defaultValues: subscriptionTier,
  })
  const { handleSubmit, watch } = form

  const editingSubscriptionTier = watch()

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
            <h1 className="text-lg font-medium">Edit Subscription Tier</h1>
            <div className="flex flex-row gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button type="submit">Save Tier</Button>
            </div>
          </div>
          <div className="flex flex-row justify-between gap-x-24">
            <div className="flex w-1/2 flex-col gap-y-6">
              <SubscriptionTierForm update={true} />
            </div>
            <div className="flex flex-col">
              <SubscriptionTierCard
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
