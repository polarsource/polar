'use client'

import { DashboardBody } from '@/components/Layout/MaintainerLayout'
import {
  Organization,
  SubscriptionTierBenefit,
  SubscriptionTierCreate,
  SubscriptionTierType,
} from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import { Button } from 'polarkit/components/ui/atoms'
import { Form } from 'polarkit/components/ui/form'
import {
  useCreateSubscriptionTier,
  useSubscriptionBenefits,
  useUpdateSubscriptionTierBenefits,
} from 'polarkit/hooks'
import React, { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'
import SubscriptionTierBenefitsForm from './SubscriptionTierBenefitsForm'
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
  const organizationBenefits = useSubscriptionBenefits(organization.name)

  if (!organizationBenefits.data) {
    return null
  }

  return (
    <SubscriptionTierCreate
      type={type}
      organization={organization}
      organizationBenefits={organizationBenefits.data.items ?? []}
    />
  )
}

export default SubscriptionTierCreatePage

interface SubscriptionTierCreateProps {
  type?: SubscriptionTierType
  organization: Organization
  organizationBenefits: SubscriptionTierBenefit[]
}

const SubscriptionTierCreate: React.FC<SubscriptionTierCreateProps> = ({
  type,
  organization,
  organizationBenefits,
}) => {
  const router = useRouter()
  const [enabledBenefitIds, setEnabledBenefitIds] = useState<
    SubscriptionTierBenefit['id'][]
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

  const createSubscriptionTier = useCreateSubscriptionTier(organization.name)
  const updateSubscriptionTierBenefits = useUpdateSubscriptionTierBenefits(
    organization.name,
  )

  const onSubmit = useCallback(
    async (subscriptionTierCreate: SubscriptionTierCreate) => {
      const tier = await createSubscriptionTier.mutateAsync(
        subscriptionTierCreate,
      )

      await updateSubscriptionTierBenefits.mutateAsync({
        id: tier.id,
        subscriptionTierBenefitsUpdate: {
          benefits: enabledBenefitIds,
        },
      })

      router.push(`/maintainer/${organization.name}/subscriptions/tiers`)
      router.refresh()
    },
    [
      router,
      organization,
      enabledBenefitIds,
      createSubscriptionTier,
      updateSubscriptionTierBenefits,
    ],
  )

  const onSelectBenefit = useCallback(
    (benefit: SubscriptionTierBenefit) => {
      setEnabledBenefitIds((benefitIds) => [...benefitIds, benefit.id])
    },
    [setEnabledBenefitIds],
  )

  const onRemoveBenefit = useCallback(
    (benefit: SubscriptionTierBenefit) => {
      setEnabledBenefitIds((benefitIds) =>
        benefitIds.filter((b) => b !== benefit.id),
      )
    },
    [setEnabledBenefitIds],
  )

  const enabledBenefits = React.useMemo(
    () =>
      organizationBenefits.filter((benefit) =>
        enabledBenefitIds.includes(benefit.id),
      ),
    [organizationBenefits, enabledBenefitIds],
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
          organizationBenefits={organizationBenefits}
          onSelectBenefit={onSelectBenefit}
          onRemoveBenefit={onRemoveBenefit}
        />
      </div>
    </DashboardBody>
  )
}
