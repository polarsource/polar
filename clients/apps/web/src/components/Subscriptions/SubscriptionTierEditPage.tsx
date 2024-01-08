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
import { Button, ShadowBoxOnMd } from 'polarkit/components/ui/atoms'
import { Form } from 'polarkit/components/ui/form'
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
import { SubscriptionBenefit, isPremiumArticlesBenefit } from './utils'

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
  organizationBenefits: SubscriptionBenefit[]
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
    shouldUnregister: true,
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
      console.log(subscriptionTierUpdate)
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
      <Form {...form}>
        <div className="flex flex-col items-start justify-between gap-12 md:flex-row">
          <ShadowBoxOnMd className="relative flex w-full flex-col gap-y-12 md:w-2/3">
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="mb-8 flex items-center justify-between">
                <h1 className="text-lg font-medium">Edit Subscription Tier</h1>
              </div>
              <div className="relative flex flex-row justify-between gap-x-24">
                <div className="flex w-full flex-col gap-y-6">
                  <SubscriptionTierForm update={true} isFreeTier={isFreeTier} />
                </div>
              </div>
            </form>
            <SubscriptionTierBenefitsForm
              className="max-w-2/3 w-full"
              organization={organization}
              organizationBenefits={organizationBenefits.filter(
                (benefit) =>
                  // Hide not selectable benefits unless they are already enabled
                  (benefit.selectable ||
                    enabledBenefits.some((b) => b.id === benefit.id)) &&
                  // Hide premium articles benefit on free tier
                  (!isFreeTier || !isPremiumArticlesBenefit(benefit)),
              )}
              benefits={enabledBenefits}
              onSelectBenefit={onSelectBenefit}
              onRemoveBenefit={onRemoveBenefit}
            />
            {!isFreeTier && (
              <>
                <div className="dark:bg-polar-800 dark:border-polar-700 flex w-full flex-col space-y-4 rounded-2xl border border-gray-200 bg-white p-6 md:flex-row md:items-start md:justify-between md:space-y-0">
                  <div className="flex flex-col gap-y-2">
                    <h3 className="max-w-1/3">Archive Subscription Tier</h3>
                    <p className="dark:text-polar-500 w-3/4 text-sm text-gray-400">
                      Archiving a subscription tier will not affect its current
                      subscribers, only prevent new subscribers.
                    </p>
                  </div>
                  <Button
                    className="self-start"
                    variant="destructive"
                    onClick={showArchiveModal}
                  >
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
          </ShadowBoxOnMd>
          <SubscriptionTierCard
            className="w-full md:w-1/4"
            subscriptionTier={{
              ...subscriptionTier,
              ...editingSubscriptionTier,
              benefits: enabledBenefits,
            }}
            isEditing={true}
          />
        </div>
      </Form>
    </DashboardBody>
  )
}
