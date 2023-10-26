'use client'

import { DashboardBody } from '@/components/Layout/MaintainerLayout'
import {
  ListResourceUnionSubscriptionBenefitBuiltinSubscriptionBenefitCustom,
  Organization,
  SubscriptionBenefitBuiltin,
  SubscriptionBenefitCustom,
  SubscriptionTierCreate,
  SubscriptionTierType,
} from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import { api } from 'polarkit'
import { Button } from 'polarkit/components/ui/atoms'
import { Form } from 'polarkit/components/ui/form'
import React, { useCallback } from 'react'
import { useForm } from 'react-hook-form'
import SubscriptionTierBenefitsForm from './SubscriptionTierBenefitsForm'
import SubscriptionTierCard from './SubscriptionTierCard'
import SubscriptionTierForm from './SubscriptionTierForm'

interface SubscriptionTierCreatePageProps {
  type?: SubscriptionTierType
  organization: Organization
  benefits: ListResourceUnionSubscriptionBenefitBuiltinSubscriptionBenefitCustom
}

export interface SubscriptionTierCreatePageForm {
  tier: SubscriptionTierCreate
  benefits: (SubscriptionBenefitBuiltin | SubscriptionBenefitCustom)[]
}

const SubscriptionTierCreatePage: React.FC<SubscriptionTierCreatePageProps> = ({
  type,
  organization,
  benefits,
}) => {
  const router = useRouter()

  const form = useForm<SubscriptionTierCreatePageForm>({
    defaultValues: {
      tier: {
        organization_id: organization.id,
        ...(type ? { type } : {}),
      },
      benefits: [],
    },
  })
  const { handleSubmit, watch } = form

  const newSubscriptionTier = watch()

  const selectedSubscriptionTierType = watch('tier.type')

  const onSubmit = useCallback(
    async (subscriptionTierCreate: SubscriptionTierCreatePageForm) => {
      await api.subscriptions.createSubscriptionTier({
        subscriptionTierCreate: subscriptionTierCreate.tier,
      })
      router.push(`/maintainer/${organization.name}/subscriptions/tiers`)
      router.refresh()
    },
    [router, organization],
  )

  return (
    <DashboardBody>
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
            <div className="flex w-1/2 flex-col gap-y-6 ">
              <SubscriptionTierForm update={false} />
              <SubscriptionTierBenefitsForm
                organizationBenefits={[
                  {
                    id: '123',
                    description: 'This is a nice benefit',
                    created_at: '',
                    type: 'custom' as const,
                    properties: {},
                    is_tax_applicable: true,
                  },
                  {
                    id: '456',
                    description: 'This is a simple benefit',
                    created_at: '',
                    type: 'custom' as const,
                    properties: {},
                    is_tax_applicable: true,
                  },
                  {
                    id: '789',
                    description: 'This is an amazing benefit',
                    created_at: '',
                    type: 'custom' as const,
                    properties: {},
                    is_tax_applicable: true,
                  },
                ]}
              />
            </div>
            <div className="flex flex-col">
              {selectedSubscriptionTierType && (
                <SubscriptionTierCard subscriptionTier={newSubscriptionTier} />
              )}
            </div>
          </div>
        </form>
      </Form>
    </DashboardBody>
  )
}

export default SubscriptionTierCreatePage
