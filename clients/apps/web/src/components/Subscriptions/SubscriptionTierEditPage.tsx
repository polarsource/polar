'use client'

import revalidate from '@/app/actions'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useRecurringInterval } from '@/hooks/subscriptions'
import {
  Organization,
  ResponseError,
  SubscriptionTier,
  SubscriptionTierPrice,
  SubscriptionTierType,
  SubscriptionTierUpdate,
  ValidationError,
} from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import { setValidationErrors } from 'polarkit/api/errors'
import Button from 'polarkit/components/ui/atoms/button'
import { ShadowBoxOnMd } from 'polarkit/components/ui/atoms/shadowbox'
import { Form } from 'polarkit/components/ui/form'
import {
  useArchiveSubscriptionTier,
  useSubscriptionBenefits,
  useSubscriptionStatistics,
  useSubscriptionTier,
  useUpdateSubscriptionTier,
  useUpdateSubscriptionTierBenefits,
} from 'polarkit/hooks'
import React, { useCallback, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Benefit } from '../Benefit/Benefit'
import { ConfirmModal } from '../Modal/ConfirmModal'
import { useModal } from '../Modal/useModal'
import SubscriptionTierBenefitsForm from './SubscriptionTierBenefitsForm'
import SubscriptionTierCard from './SubscriptionTierCard'
import SubscriptionTierForm from './SubscriptionTierForm'
import SubscriptionTierRecurringIntervalSwitch from './SubscriptionTierRecurringIntervalSwitch'
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
  const [enabledBenefitIds, setEnabledBenefitIds] = useState<Benefit['id'][]>(
    subscriptionTier.benefits.map((benefit) => benefit.id) ?? [],
  )
  const isFreeTier = subscriptionTier.type === SubscriptionTierType.FREE
  const [recurringInterval, setRecurringInterval] = useRecurringInterval()

  const now = useMemo(() => new Date(), [])
  const { data: subscriptionStatistics } = useSubscriptionStatistics(
    organization.name,
    now,
    now,
    undefined,
    subscriptionTier.id,
  )
  const nbSubscribers = useMemo(
    () => subscriptionStatistics?.periods[0].subscribers || 0,
    [subscriptionStatistics],
  )

  const form = useForm<SubscriptionTierUpdate>({
    defaultValues: subscriptionTier,
    shouldUnregister: true,
  })
  const { handleSubmit, watch, setError } = form

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
      try {
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

        revalidate(`subscriptionTiers:${organization.name}`)

        router.push(`/maintainer/${organization.name}/subscriptions/tiers`)
        router.refresh()
      } catch (e) {
        if (e instanceof ResponseError) {
          const body = await e.response.json()
          if (e.response.status === 422) {
            const validationErrors = body['detail'] as ValidationError[]
            setValidationErrors(validationErrors, setError)
          }
        }
      }
    },
    [
      router,
      organization,
      subscriptionTier,
      enabledBenefitIds,
      updateSubscriptionTier,
      updateSubscriptionTierBenefits,
      setError,
    ],
  )

  const onSelectBenefit = useCallback(
    (benefit: Benefit) => {
      setEnabledBenefitIds((benefitIds) => [...benefitIds, benefit.id])
    },
    [setEnabledBenefitIds],
  )

  const onRemoveBenefit = useCallback(
    (benefit: Benefit) => {
      setEnabledBenefitIds((benefits) =>
        benefits.filter((b) => b !== benefit.id),
      )
    },
    [setEnabledBenefitIds],
  )

  const archiveSubscriptionTier = useArchiveSubscriptionTier(organization.name)

  const handleArchiveSubscriptionTier = useCallback(async () => {
    await archiveSubscriptionTier.mutateAsync({ id: subscriptionTier.id })

    revalidate(`subscriptionTiers:${organization.name}`)

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

  const benefitsAdded = useMemo(
    () =>
      enabledBenefits.filter(
        (benefit) =>
          !subscriptionTier.benefits.some(({ id }) => id === benefit.id),
      ),
    [enabledBenefits, subscriptionTier],
  )
  const benefitsRemoved = useMemo(
    () =>
      subscriptionTier.benefits.filter(
        (benefit) => !enabledBenefits.some(({ id }) => id === benefit.id),
      ),
    [enabledBenefits, subscriptionTier],
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

            {(benefitsAdded.length > 0 || benefitsRemoved.length > 0) &&
              nbSubscribers > 0 && (
                <div className="rounded-2xl bg-yellow-50 px-4 py-3 text-sm text-yellow-500 dark:bg-yellow-950">
                  Existing {nbSubscribers} subscribers will immediately{' '}
                  {benefitsAdded.length > 0 && (
                    <>
                      get access to{' '}
                      {benefitsAdded
                        .map((benefit) => benefit.description)
                        .join(', ')}
                    </>
                  )}
                  {benefitsRemoved.length > 0 && (
                    <>
                      {benefitsAdded.length > 0 && ' and '}lose access to{' '}
                      {benefitsRemoved
                        .map((benefit) => benefit.description)
                        .join(', ')}
                    </>
                  )}
                  .
                </div>
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
          <div className="flex w-full flex-col items-center gap-2 md:w-1/4">
            <SubscriptionTierRecurringIntervalSwitch
              recurringInterval={recurringInterval}
              onChange={setRecurringInterval}
            />
            <SubscriptionTierCard
              className="w-full"
              subscriptionTier={{
                ...subscriptionTier,
                ...editingSubscriptionTier,
                benefits: enabledBenefits,
                prices: subscriptionTier.prices as SubscriptionTierPrice[],
              }}
              isEditing={true}
              recurringInterval={recurringInterval}
            />
          </div>
        </div>
      </Form>
    </DashboardBody>
  )
}
