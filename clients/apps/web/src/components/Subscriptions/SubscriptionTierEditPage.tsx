'use client'

import { DashboardBody } from '@/components/Layout/MaintainerLayout'
import {
  Organization,
  SubscriptionTier,
  SubscriptionTierBenefit,
  SubscriptionTierUpdate,
} from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import { Button } from 'polarkit/components/ui/atoms'
import { Form } from 'polarkit/components/ui/form'
import {
  useSubscriptionBenefits,
  useSubscriptionTier,
  useUpdateSubscriptionTier,
  useUpdateSubscriptionTierBenefits,
} from 'polarkit/hooks'
import React, { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'
import SubscriptionTierBenefitsForm from './SubscriptionTierBenefitsForm'
import SubscriptionTierCard from './SubscriptionTierCard'
import SubscriptionTierForm from './SubscriptionTierForm'

interface SubscriptionTierEditPageProps {
  organization: Organization
  tier: string
}

const SubscriptionTierEditPage: React.FC<SubscriptionTierEditPageProps> = ({
  organization,
  tier,
}) => {
  const subscriptionTier = useSubscriptionTier(tier)
  const organizationBenefits = useSubscriptionBenefits(organization.name)

  if (!subscriptionTier.data || !organizationBenefits.data) {
    return null
  }

  return (
    <SubscriptionTierEdit
      organization={organization}
      subscriptionTier={subscriptionTier.data}
      organizationBenefits={organizationBenefits.data.items ?? []}
    />
  )
}

export default SubscriptionTierEditPage

interface SubscriptionTierEditProps {
  organization: Organization
  subscriptionTier: SubscriptionTier
  organizationBenefits: SubscriptionTierBenefit[]
}

const SubscriptionTierEdit = ({
  organization,
  subscriptionTier,
  organizationBenefits,
}: SubscriptionTierEditProps) => {
  const router = useRouter()
  const [enabledBenefits, setEnabledBenefits] = useState<
    SubscriptionTierBenefit[]
  >(subscriptionTier.benefits ?? [])

  const form = useForm<SubscriptionTierUpdate>({
    defaultValues: subscriptionTier,
  })
  const { handleSubmit, watch } = form

  const editingSubscriptionTier = watch()

  const updateSubscriptionTier = useUpdateSubscriptionTier()
  const updateSubscriptionTierBenefits = useUpdateSubscriptionTierBenefits()

  const onSubmit = useCallback(
    async (subscriptionTierUpdate: SubscriptionTierUpdate) => {
      await updateSubscriptionTier.mutateAsync({
        id: subscriptionTier.id,
        subscriptionTierUpdate,
      })

      await updateSubscriptionTierBenefits.mutateAsync({
        id: subscriptionTier.id,
        subscriptionTierBenefitsUpdate: {
          benefits: enabledBenefits.map((benefit) => benefit.id),
        },
      })

      router.push(`/maintainer/${organization.name}/subscriptions/tiers`)
      router.refresh()
    },
    [
      router,
      organization,
      subscriptionTier,
      enabledBenefits,
      updateSubscriptionTier,
      updateSubscriptionTierBenefits,
    ],
  )

  const onSelectBenefit = useCallback(
    (benefit: SubscriptionTierBenefit) => {
      setEnabledBenefits((benefits) => [...benefits, benefit])
    },
    [setEnabledBenefits],
  )

  const onRemoveBenefit = useCallback(
    (benefit: SubscriptionTierBenefit) => {
      setEnabledBenefits((benefits) =>
        benefits.filter((b) => b.id !== benefit.id),
      )
    },
    [setEnabledBenefits],
  )

  return (
    <DashboardBody>
      <div className="flex flex-col gap-y-12">
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
            <div className="relative flex flex-row justify-between gap-x-24">
              <div className="flex w-1/2 flex-col gap-y-6">
                <SubscriptionTierForm update={true} />
              </div>
              <div className="absolute right-0 top-0 flex flex-col">
                <SubscriptionTierCard
                  subscriptionTier={{
                    ...editingSubscriptionTier,
                    benefits: enabledBenefits,
                  }}
                />
              </div>
            </div>
          </form>
        </Form>
        <SubscriptionTierBenefitsForm
          className="w-1/2"
          organization={organization}
          organizationBenefits={organizationBenefits}
          benefits={enabledBenefits}
          onSelectBenefit={onSelectBenefit}
          onRemoveBenefit={onRemoveBenefit}
        />
      </div>
    </DashboardBody>
  )
}
