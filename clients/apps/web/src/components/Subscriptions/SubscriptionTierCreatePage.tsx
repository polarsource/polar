'use client'

import { DashboardBody } from '@/components/Layout/MaintainerLayout'
import {
  Organization,
  SubscriptionTierCreate,
  SubscriptionTierType,
} from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import { api } from 'polarkit'
import { Button } from 'polarkit/components/ui/atoms'
import { Form } from 'polarkit/components/ui/form'
import React, { useCallback } from 'react'
import { useForm } from 'react-hook-form'
import SubscriptionTierCard from './SubscriptionTierCard'
import SubscriptionTierForm from './SubscriptionTierForm'

interface SubscriptionTierCreatePageProps {
  type?: SubscriptionTierType
  organization: Organization
}

const SubscriptionTierCreatePage: React.FC<SubscriptionTierCreatePageProps> = ({
  type,
  organization,
}) => {
  const router = useRouter()

  const form = useForm<SubscriptionTierCreate>({
    defaultValues: {
      organization_id: organization.id,
      ...(type ? { type } : {}),
    },
  })
  const { handleSubmit, watch } = form

  const newSubscriptionTier = watch()

  const selectedSubscriptionTierType = watch('type')

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
            <div className="flex w-1/2 flex-col gap-y-6 ">
              <SubscriptionTierForm update={false} />
            </div>
            <div className="flex flex-col">
              {selectedSubscriptionTierType && (
                <SubscriptionTierCard subscriptionTier={newSubscriptionTier} />
              )}
            </div>
          </div>
        </form>
      </Form>
    </DashboardBody>
  )
}

export default SubscriptionTierCreatePage
