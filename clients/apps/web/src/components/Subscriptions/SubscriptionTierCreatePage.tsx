'use client'

import revalidate from '@/app/actions'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import {
  Organization,
  ResponseError,
  SubscriptionTierCreate,
  SubscriptionTierCreateTypeEnum,
  ValidationError,
} from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import { setValidationErrors } from 'polarkit/api/errors'
import Button from 'polarkit/components/ui/atoms/button'
import { ShadowBoxOnMd } from 'polarkit/components/ui/atoms/shadowbox'
import { Form } from 'polarkit/components/ui/form'
import {
  useCreateSubscriptionTier,
  useSubscriptionBenefits,
  useSubscriptionTiers,
  useUpdateSubscriptionTierBenefits,
} from 'polarkit/hooks'
import { useStore } from 'polarkit/store'
import React, { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Benefit } from '../Benefit/Benefit'
import SubscriptionTierBenefitsForm from './SubscriptionTierBenefitsForm'
import SubscriptionTierCard from './SubscriptionTierCard'
import SubscriptionTierForm from './SubscriptionTierForm'
import { SubscriptionBenefit, isPremiumArticlesBenefit } from './utils'

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
  organizationBenefits: SubscriptionBenefit[]
}

const SubscriptionTierCreate: React.FC<SubscriptionTierCreateProps> = ({
  type,
  organization,
  organizationBenefits,
}) => {
  const router = useRouter()
  const {
    formDrafts: { SubscriptionTierCreate: savedFormValues },
    saveDraft,
    clearDraft,
  } = useStore()
  const [enabledBenefitIds, setEnabledBenefitIds] = useState<
    Benefit['id'][]
    // Pre-select premium articles benefit
  >(organizationBenefits.filter(isPremiumArticlesBenefit).map(({ id }) => id))

  const highlightedTiers =
    useSubscriptionTiers(organization.name, 100).data?.items?.filter(
      (tier) => tier.is_highlighted,
    ) ?? []

  const shouldBeHighlighted = highlightedTiers.length < 1

  const form = useForm<SubscriptionTierCreate>({
    defaultValues: {
      ...(type ? { type } : {}),
      ...(savedFormValues ? savedFormValues : {}),
      organization_id: organization.id,
      is_highlighted: shouldBeHighlighted,
    },
  })
  const { handleSubmit, watch, setError } = form

  const newSubscriptionTier = watch()
  const selectedSubscriptionTierType = watch('type')

  const createSubscriptionTier = useCreateSubscriptionTier(organization.name)
  const updateSubscriptionTierBenefits = useUpdateSubscriptionTierBenefits(
    organization.name,
  )

  const onSubmit = useCallback(
    async (subscriptionTierCreate: SubscriptionTierCreate) => {
      try {
        const tier = await createSubscriptionTier.mutateAsync(
          subscriptionTierCreate,
        )
        await updateSubscriptionTierBenefits.mutateAsync({
          id: tier.id,
          subscriptionTierBenefitsUpdate: {
            benefits: enabledBenefitIds,
          },
        })

        clearDraft('SubscriptionTierCreate')

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
      enabledBenefitIds,
      createSubscriptionTier,
      updateSubscriptionTierBenefits,
      setError,
      clearDraft,
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

  useEffect(() => {
    const pagehideListener = () => {
      saveDraft('SubscriptionTierCreate', newSubscriptionTier)
    }
    window.addEventListener('pagehide', pagehideListener)
    return () => window.removeEventListener('pagehide', pagehideListener)
  }, [newSubscriptionTier, saveDraft])

  return (
    <DashboardBody>
      <Form {...form}>
        <div className="flex flex-col items-start justify-between gap-12 md:flex-row">
          <ShadowBoxOnMd className="relative flex w-full flex-col gap-y-12 md:w-2/3">
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="mb-8 flex items-center justify-between">
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
              organizationBenefits={organizationBenefits.filter(
                (benefit) =>
                  // Hide not selectable benefits unless they are already enabled
                  benefit.selectable ||
                  enabledBenefits.some((b) => b.id === benefit.id),
              )}
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
          </ShadowBoxOnMd>
          {selectedSubscriptionTierType && (
            <SubscriptionTierCard
              className="w-full md:w-1/4"
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
