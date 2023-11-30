'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import {
  Organization,
  SubscriptionTier,
  SubscriptionTierBenefit,
  SubscriptionTierType,
  SubscriptionTierUpdate,
} from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import { Button } from 'polarkit/components/ui/atoms'
import { Form } from 'polarkit/components/ui/form'
import { Separator } from 'polarkit/components/ui/separator'
import {
  useArchiveSubscriptionTier,
  useSubscriptionBenefits,
  useSubscriptionTier,
  useUpdateSubscriptionTier,
  useUpdateSubscriptionTierBenefits,
} from 'polarkit/hooks'
import React, { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useModal } from '../Modal/useModal'
import { ConfirmModal } from '../Shared/ConfirmModal'
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
  const [enabledBenefitIds, setEnabledBenefitIds] = useState<
    SubscriptionTierBenefit['id'][]
  >(subscriptionTier.benefits.map((benefit) => benefit.id) ?? [])
  const isFreeTier = subscriptionTier.type === SubscriptionTierType.FREE

  const form = useForm<SubscriptionTierUpdate>({
    defaultValues: subscriptionTier,
  })
  const { handleSubmit, watch } = form

  const editingSubscriptionTier = watch()

  const updateSubscriptionTier = useUpdateSubscriptionTier(organization.name)
  const updateSubscriptionTierBenefits = useUpdateSubscriptionTierBenefits(
    organization.name,
  )

  const {
    isShown: isArchiveModalShown,
    hide: hideArchiveModal,
    show: showArchiveModal,
  } = useModal()

  const onSubmit = useCallback(
    async (subscriptionTierUpdate: SubscriptionTierUpdate) => {
      await updateSubscriptionTier.mutateAsync({
        id: subscriptionTier.id,
        subscriptionTierUpdate,
      })

      await updateSubscriptionTierBenefits.mutateAsync({
        id: subscriptionTier.id,
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
      subscriptionTier,
      enabledBenefitIds,
      updateSubscriptionTier,
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
      setEnabledBenefitIds((benefits) =>
        benefits.filter((b) => b !== benefit.id),
      )
    },
    [setEnabledBenefitIds],
  )

  const archiveSubscriptionTier = useArchiveSubscriptionTier(organization.name)

  const handleArchiveSubscriptionTier = useCallback(async () => {
    await archiveSubscriptionTier.mutateAsync({ id: subscriptionTier.id })

    router.push(`/maintainer/${organization.name}/subscriptions/tiers`)
    router.refresh()
  }, [subscriptionTier, archiveSubscriptionTier, router, organization])

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
                <SubscriptionTierForm update={true} isFreeTier={isFreeTier} />
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
        {!isFreeTier && (
          <>
            <Separator className="w-1/2" />
            <div className="flex w-1/2 flex-row items-start justify-between">
              <div>
                <h3 className="max-w-1/2">Archive Subscription Tier</h3>
                <p className="dark:text-polar-500 mb-6 mt-2 w-3/4 text-sm  text-gray-400">
                  Archiving a subscription tier will not affect its current
                  subscribers, only prevent new subscribers.
                </p>
              </div>
              <Button variant="destructive" onClick={showArchiveModal}>
                Archive
              </Button>
            </div>
            <ConfirmModal
              title="Archive Subscription Tier"
              description="Archiving a subscription tier will not affect its current subscribers, only prevent new subscribers. An archived subscription tier is permanently archived."
              onConfirm={handleArchiveSubscriptionTier}
              isShown={isArchiveModalShown}
              hide={hideArchiveModal}
              destructiveText="Archive"
              destructive
            />
          </>
        )}
      </div>
    </DashboardBody>
  )
}
