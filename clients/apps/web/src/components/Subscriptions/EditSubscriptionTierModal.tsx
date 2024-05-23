'use client'

import revalidate from '@/app/actions'
import {
  useBenefits,
  useProduct,
  useSubscriptionStatistics,
  useUpdateProduct,
  useUpdateProductBenefits,
} from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import {
  BenefitPublicInner,
  Organization,
  Product,
  ProductUpdate,
  ResponseError,
  SubscriptionTierType,
  ValidationError,
} from '@polar-sh/sdk'
import Button from 'polarkit/components/ui/atoms/button'
import { Form } from 'polarkit/components/ui/form'
import React, { useCallback, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { isPremiumArticlesBenefit } from '../Benefit/utils'
import { ConfirmModal } from '../Modal/ConfirmModal'
import { InlineModalHeader } from '../Modal/InlineModal'
import { useModal } from '../Modal/useModal'
import SubscriptionTierBenefitsForm from './SubscriptionTierBenefitsForm'
import SubscriptionTierForm from './SubscriptionTierForm'

interface SubscriptionTierEditModalProps {
  organization: Organization
  tier: string
  hide: () => void
}

const SubscriptionTierEditModal: React.FC<SubscriptionTierEditModalProps> = ({
  organization,
  tier,
  hide,
}) => {
  const subscriptionTier = useProduct(tier)
  const organizationBenefits = useBenefits(organization.id)

  if (!subscriptionTier.data || !organizationBenefits.data) {
    return null
  }

  return (
    <SubscriptionTierEditModalContent
      organization={organization}
      subscriptionTier={subscriptionTier.data}
      organizationBenefits={organizationBenefits.data.items ?? []}
      hide={hide}
    />
  )
}

export default SubscriptionTierEditModal

interface SubscriptionTierEditModalContentProps {
  organization: Organization
  subscriptionTier: Product
  organizationBenefits: BenefitPublicInner[]
  hide: () => void
}

const SubscriptionTierEditModalContent = ({
  organization,
  subscriptionTier,
  organizationBenefits,
  hide,
}: SubscriptionTierEditModalContentProps) => {
  const [enabledBenefitIds, setEnabledBenefitIds] = useState<
    BenefitPublicInner['id'][]
  >(subscriptionTier.benefits.map((benefit) => benefit.id) ?? [])
  const isFreeTier = subscriptionTier.type === SubscriptionTierType.FREE

  const now = useMemo(() => new Date(), [])
  const { data: subscriptionStatistics } = useSubscriptionStatistics({
    orgName: organization.name,
    platform: organization.platform,
    startDate: now,
    endDate: now,
    subscriptionTierId: subscriptionTier.id,
  })
  const nbSubscribers = useMemo(
    () => subscriptionStatistics?.periods[0].subscribers || 0,
    [subscriptionStatistics],
  )

  const form = useForm<ProductUpdate>({
    defaultValues: subscriptionTier,
    shouldUnregister: true,
  })
  const { handleSubmit, setError } = form

  const updateSubscriptionTier = useUpdateProduct(organization.id)
  const updateSubscriptionTierBenefits = useUpdateProductBenefits(
    organization.id,
  )

  const {
    isShown: isArchiveModalShown,
    hide: hideArchiveModal,
    show: showArchiveModal,
  } = useModal()

  const onSubmit = useCallback(
    async (productUpdate: ProductUpdate) => {
      try {
        await updateSubscriptionTier.mutateAsync({
          id: subscriptionTier.id,
          productUpdate,
        })
        await updateSubscriptionTierBenefits.mutateAsync({
          id: subscriptionTier.id,
          productBenefitsUpdate: {
            benefits: enabledBenefitIds,
          },
        })

        revalidate(`products:${organization.id}:recurring`)
        revalidate(`products:${organization.id}:one_time`)

        hide()
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
      organization,
      subscriptionTier,
      enabledBenefitIds,
      updateSubscriptionTier,
      updateSubscriptionTierBenefits,
      setError,
      hide,
    ],
  )

  const onSelectBenefit = useCallback(
    (benefit: BenefitPublicInner) => {
      setEnabledBenefitIds((benefitIds) => [...benefitIds, benefit.id])
    },
    [setEnabledBenefitIds],
  )

  const onRemoveBenefit = useCallback(
    (benefit: BenefitPublicInner) => {
      setEnabledBenefitIds((benefits) =>
        benefits.filter((b) => b !== benefit.id),
      )
    },
    [setEnabledBenefitIds],
  )

  const handleArchiveSubscriptionTier = useCallback(async () => {
    await updateSubscriptionTier.mutateAsync({
      id: subscriptionTier.id,
      productUpdate: { is_archived: true },
    })

    revalidate(`products:${organization.id}:recurring`)
    revalidate(`products:${organization.id}:one_time`)

    hide()
  }, [subscriptionTier, updateSubscriptionTier, organization, hide])

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
    <div className="flex flex-col overflow-y-auto">
      <InlineModalHeader hide={hide}>
        <h1 className="text-lg font-medium">Edit Subscription Tier</h1>
      </InlineModalHeader>
      <Form {...form}>
        <div className="flex flex-col justify-between gap-12 p-8">
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="flex w-full flex-col gap-y-8 ">
              <SubscriptionTierForm update={true} isFreeTier={isFreeTier} />
            </div>
          </form>
          <SubscriptionTierBenefitsForm
            className="w-full"
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
              <div className="dark:bg-polar-700 flex w-full flex-col space-y-4 rounded-2xl bg-gray-100 p-6">
                <div className="flex flex-col gap-y-2">
                  <h3 className="text-sm font-medium">
                    Archive Subscription Tier
                  </h3>
                  <p className="dark:text-polar-500 text-sm text-gray-500">
                    Archiving a subscription tier will not affect its current
                    subscribers, only prevent new subscribers.
                  </p>
                </div>
                <Button
                  className="self-start"
                  variant="destructive"
                  onClick={showArchiveModal}
                  size="sm"
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
            <Button
              onClick={handleSubmit(onSubmit)}
              loading={updateSubscriptionTier.isPending}
            >
              Save Tier
            </Button>
            <Button type="button" variant="ghost" onClick={hide}>
              Cancel
            </Button>
          </div>
        </div>
      </Form>
    </div>
  )
}
