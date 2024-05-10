'use client'

import revalidate from '@/app/actions'
import {
  useBenefits,
  useCreateSubscriptionTier,
  useSubscriptionTiers,
  useUpdateSubscriptionTierBenefits,
} from '@/hooks/queries'
import { useStore } from '@/store'
import { setValidationErrors } from '@/utils/api/errors'
import {
  BenefitPublicInner,
  Organization,
  ResponseError,
  SubscriptionTierCreate as SubscriptionTierCreateSchema,
  SubscriptionTierCreateTypeEnum,
  ValidationError,
} from '@polar-sh/sdk'
import Button from 'polarkit/components/ui/atoms/button'
import { Form } from 'polarkit/components/ui/form'
import React, { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { isPremiumArticlesBenefit } from '../Benefit/utils'
import { InlineModalHeader } from '../Modal/InlineModal'
import SubscriptionTierBenefitsForm from './SubscriptionTierBenefitsForm'
import SubscriptionTierForm from './SubscriptionTierForm'

interface CreateSubscriptionTierModalProps {
  type?: SubscriptionTierCreateTypeEnum
  organization: Organization
  hide: () => void
}

const CreateSubscriptionTierModal: React.FC<
  CreateSubscriptionTierModalProps
> = ({ type, organization, hide }) => {
  const organizationBenefits = useBenefits(organization.id)

  if (!organizationBenefits.data) {
    return null
  }

  return (
    <CreateSubscriptionTierModalContent
      type={type}
      organization={organization}
      organizationBenefits={organizationBenefits.data.items ?? []}
      hide={hide}
    />
  )
}

export default CreateSubscriptionTierModal

interface CreateSubscriptionTierModalContentProps {
  type?: SubscriptionTierCreateTypeEnum
  organization: Organization
  organizationBenefits: BenefitPublicInner[]
  hide: () => void
}

const CreateSubscriptionTierModalContent: React.FC<
  CreateSubscriptionTierModalContentProps
> = ({ type, organization, organizationBenefits, hide }) => {
  const {
    formDrafts: { SubscriptionTierCreate: savedFormValues },
    saveDraft,
    clearDraft,
  } = useStore()

  const [enabledBenefitIds, setEnabledBenefitIds] = useState<
    BenefitPublicInner['id'][]
    // Pre-select premium articles benefit
  >(organizationBenefits.filter(isPremiumArticlesBenefit).map(({ id }) => id))

  const highlightedTiers =
    useSubscriptionTiers(organization.name, 100).data?.items?.filter(
      (tier) => tier.is_highlighted,
    ) ?? []

  const shouldBeHighlighted = highlightedTiers.length < 1

  const form = useForm<SubscriptionTierCreateSchema>({
    defaultValues: {
      ...(type ? { type } : {}),
      ...(savedFormValues ? savedFormValues : {}),
      organization_id: organization.id,
      is_highlighted: shouldBeHighlighted,
      prices: [
        {
          recurring_interval: 'month',
          price_amount: undefined,
          price_currency: 'usd',
        },
      ],
    },
  })
  const { handleSubmit, watch, setError } = form

  const newSubscriptionTier = watch()

  const createSubscriptionTier = useCreateSubscriptionTier(organization.name)
  const updateSubscriptionTierBenefits = useUpdateSubscriptionTierBenefits(
    organization.name,
  )

  const onSubmit = useCallback(
    async (subscriptionTierCreate: SubscriptionTierCreateSchema) => {
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
      enabledBenefitIds,
      createSubscriptionTier,
      updateSubscriptionTierBenefits,
      setError,
      clearDraft,
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
    <div className="flex flex-col overflow-y-auto">
      <InlineModalHeader hide={hide}>
        <h1 className="text-lg font-medium">New Subscription Tier</h1>
      </InlineModalHeader>
      <Form {...form}>
        <div className="flex flex-col items-start justify-between gap-12 p-8">
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="flex w-full flex-col gap-y-8">
              <SubscriptionTierForm update={false} />
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
            <Button
              onClick={handleSubmit(onSubmit)}
              loading={createSubscriptionTier.isPending}
            >
              Create Tier
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
