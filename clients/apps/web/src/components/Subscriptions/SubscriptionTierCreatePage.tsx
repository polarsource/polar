'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import {
  Organization,
  SubscriptionTierBenefit,
  SubscriptionTierCreate,
  SubscriptionTierCreateTypeEnum,
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
  type?: SubscriptionTierCreateTypeEnum
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
  type?: SubscriptionTierCreateTypeEnum
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
      <Form {...form}>
        <div className="flex flex-row items-start justify-between gap-x-12">
          <div className="dark:bg-polar-900 dark:border-polar-800 relative flex w-2/3 flex-col gap-y-12 rounded-3xl border border-gray-100 bg-white p-10 shadow-sm">
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="mb-16 flex items-center justify-between">
                <h1 className="text-lg font-medium">New Subscription Tier</h1>
              </div>
              <div className="relative flex w-full flex-row justify-between gap-x-24">
                <div className="flex w-full flex-col gap-y-6">
                  <SubscriptionTierForm update={false} />
                </div>
              </div>
            </form>
            <SubscriptionTierBenefitsForm
              benefits={enabledBenefits}
              organization={organization}
              organizationBenefits={organizationBenefits}
              onSelectBenefit={onSelectBenefit}
              onRemoveBenefit={onRemoveBenefit}
            />
            <div className="flex flex-row gap-2">
              <Button onClick={handleSubmit(onSubmit)}>Save Tier</Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
            </div>
          </div>
          {selectedSubscriptionTierType && (
            <SubscriptionTierCard
              subscriptionTier={{
                ...newSubscriptionTier,
                benefits: enabledBenefits,
              }}
            />
          )}
        </div>
      </Form>
    </DashboardBody>
  )
}
