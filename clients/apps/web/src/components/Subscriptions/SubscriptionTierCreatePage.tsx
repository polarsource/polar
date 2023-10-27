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
import React, { useCallback, useState } from 'react'
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
  const [benefits, setBenefits] = useState<SubscriptionTierBenefit[]>([])

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
          benefits: benefits.map((benefit) => benefit.id),
        },
      })

      router.push(`/maintainer/${organization.name}/subscriptions/tiers`)
      router.refresh()
    },
    [router, organization, benefits],
  )

  const onSelectBenefit = useCallback(
    (benefit: SubscriptionTierBenefit) => {
      setBenefits((benefits) => [...benefits, benefit])
    },
    [setBenefits],
  )

  const onRemoveBenefit = useCallback(
    (benefit: SubscriptionTierBenefit) => {
      setBenefits((benefits) => benefits.filter((b) => b.id !== benefit.id))
    },
    [setBenefits],
  )

  return (
    <DashboardBody>
      <div className="flex flex-col gap-y-6">
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
              <div className="flex w-1/2 flex-col gap-y-6">
                <SubscriptionTierForm update={false} />
              </div>
              <div className="flex flex-col">
                {selectedSubscriptionTierType && (
                  <SubscriptionTierCard
                    subscriptionTier={{ ...newSubscriptionTier, benefits }}
                  />
                )}
              </div>
            </div>
          </form>
        </Form>
        <SubscriptionTierBenefitsForm
          className="w-1/2"
          benefits={benefits}
          organization={organization}
          organizationBenefits={organizationBenefits.items ?? []}
          onSelectBenefit={onSelectBenefit}
          onRemoveBenefit={onRemoveBenefit}
        />
      </div>
    </DashboardBody>
  )
}

export default SubscriptionTierCreatePage
