'use client'

import { DashboardBody } from '@/components/Layout/MaintainerLayout'
import {
  ListResourceUnionSubscriptionBenefitBuiltinSubscriptionBenefitCustom,
  Organization,
  SubscriptionTierBenefit,
  SubscriptionTierCreate,
  SubscriptionTierType,
} from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import { api } from 'polarkit'
import { Button } from 'polarkit/components/ui/atoms'
import { Form } from 'polarkit/components/ui/form'
import React, { useCallback, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import SubscriptionTierBenefitsForm from './SubscriptionTierBenefitsForm'
import SubscriptionTierCard from './SubscriptionTierCard'
import SubscriptionTierForm from './SubscriptionTierForm'

interface SubscriptionTierCreatePageProps {
  type?: SubscriptionTierType
  organization: Organization
  organizationBenefits: ListResourceUnionSubscriptionBenefitBuiltinSubscriptionBenefitCustom
}

const SubscriptionTierCreatePage: React.FC<SubscriptionTierCreatePageProps> = ({
  type,
  organization,
  organizationBenefits,
}) => {
  const router = useRouter()
  const [enabledBenefits, setEnabledBenefits] = useState<
    SubscriptionTierBenefit[]
  >([])

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
      const tier = await api.subscriptions.createSubscriptionTier({
        subscriptionTierCreate,
      })

      await api.subscriptions.updateSubscriptionTierBenefits({
        id: tier.id,
        subscriptionTierBenefitsUpdate: {
          benefits: enabledBenefits.map((benefit) => benefit.id),
        },
      })

      router.push(`/maintainer/${organization.name}/subscriptions/tiers`)
      router.refresh()
    },
    [router, organization, enabledBenefits],
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

  const newAndExistingBenefits = useMemo(
    () => [
      ...new Set([
        ...(organizationBenefits.items ?? []),
        ...enabledBenefits,
      ]).values(),
    ],
    [enabledBenefits, organizationBenefits.items],
  )

  return (
    <DashboardBody>
      <div className="flex flex-col gap-y-12">
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
            <div className="relative flex flex-row justify-between gap-x-24">
              <div className="flex w-1/2 flex-col gap-y-6">
                <SubscriptionTierForm update={false} />
              </div>
              <div className="absolute right-0 top-0 flex flex-col">
                {selectedSubscriptionTierType && (
                  <SubscriptionTierCard
                    subscriptionTier={{
                      ...newSubscriptionTier,
                      benefits: enabledBenefits,
                    }}
                  />
                )}
              </div>
            </div>
          </form>
        </Form>
        <SubscriptionTierBenefitsForm
          className="w-1/2"
          benefits={enabledBenefits}
          organization={organization}
          organizationBenefits={newAndExistingBenefits}
          onSelectBenefit={onSelectBenefit}
          onRemoveBenefit={onRemoveBenefit}
        />
      </div>
    </DashboardBody>
  )
}

export default SubscriptionTierCreatePage
