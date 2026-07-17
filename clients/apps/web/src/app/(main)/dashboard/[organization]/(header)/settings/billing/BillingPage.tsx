'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { Modal } from '@polar-sh/orbit'
import { useModal } from '@/components/Modal/useModal'
import { BillingAddressModal } from '@/components/Settings/Billing/BillingAddressModal'
import { BillingAddressSection } from '@/components/Settings/Billing/BillingAddressSection'
import { BillingBenefitGrants } from '@/components/Settings/Billing/BillingBenefitGrants'
import { BillingOrdersTable } from '@/components/Settings/Billing/BillingOrdersTable'
import { BillingPaymentMethods } from '@/components/Settings/Billing/BillingPaymentMethods'
import { BillingSubscriptionCard } from '@/components/Settings/Billing/BillingSubscriptionCard'
import { PastDueSubscriptionCallout } from '@/components/Settings/Billing/PastDueSubscriptionCallout'
import { SandboxPreviewAccessNotice } from '@/components/Settings/Billing/SandboxPreviewAccessNotice'
import { StartupProgramCallout } from '@/components/Settings/Billing/StartupProgramCallout'
import { Section, SectionDescription } from '@/components/Settings/Section'
import { LoadingBox } from '@/components/Shared/LoadingBox'
import { toast } from '@/components/Toast/use-toast'
import { usePostHog } from '@/hooks/posthog'
import { useBillingPlanCompleteListener } from '@/hooks/useBillingPlanTelemetry'
import {
  useOrganizationCustomerSession,
  useOrganizationOrders,
  useOrganizationPlans,
  useOrganizationSubscription,
} from '@/hooks/queries/billing'

import { PolarEmbedPaymentMethod } from '@polar-sh/checkout/payment-method'
import { usePaymentMethodRedirectResult } from '@polar-sh/checkout/react/payment-method'
import { CONFIG } from '@/utils/config'
import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import { useQueryClient } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'

export default function BillingPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const theme = useTheme()
  const posthog = usePostHog()

  const subscriptionQuery = useOrganizationSubscription(organization.id)
  const plansQuery = useOrganizationPlans(organization.id)
  const ordersQuery = useOrganizationOrders(organization.id)

  const customerSessionQuery = useOrganizationCustomerSession(organization.id)

  const [addPaymentMethodError, setAddPaymentMethodError] = useState<
    string | null
  >(null)

  useBillingPlanCompleteListener({
    organizationId: organization.id,
    redirectPath: `/dashboard/${organization.slug}/settings/billing`,
    onComplete: useCallback(() => {
      queryClient.invalidateQueries({
        queryKey: ['organization-billing', organization.id],
      })
    }, [queryClient, organization.id]),
  })

  usePaymentMethodRedirectResult({
    onSuccess: () => toast({ title: 'Payment method added' }),
    onError: () =>
      setAddPaymentMethodError(
        'Could not add payment method. Please try again.',
      ),
  })

  const {
    isShown: isBillingAddressOpen,
    show: showBillingAddress,
    hide: hideBillingAddress,
  } = useModal()

  const onAddPaymentMethod = async () => {
    setAddPaymentMethodError(null)
    const session = customerSessionQuery.data
    if (!session) {
      toast({
        title: 'Could not start the payment method flow',
        description: 'Please try again in a moment.',
        variant: 'error',
      })
      return
    }
    const embed = await PolarEmbedPaymentMethod.create({
      sessionToken: session.token,
      theme: theme.resolvedTheme === 'dark' ? 'dark' : 'light',
    })
    embed.addEventListener('success', () => {
      queryClient.invalidateQueries({
        queryKey: ['organization-billing', organization.id, 'payment-methods'],
      })
      queryClient.invalidateQueries({
        queryKey: ['organization-billing', organization.id, 'customer-session'],
      })
    })
  }

  const onChangePlan = () => {
    posthog.capture('dashboard:subscriptions:change_plan:click', {
      organization_id: organization.id,
      current_plan: subscriptionQuery.data?.plan.name ?? null,
      current_plan_product_id: subscriptionQuery.data?.product_id ?? null,
    })
    router.push(`/dashboard/${organization.slug}/settings/billing/change-plan`)
  }

  if (CONFIG.IS_SANDBOX) {
    return (
      <DashboardBody
        wrapperClassName="max-w-(--breakpoint-md)!"
        title="Billing"
      >
        <SandboxPreviewAccessNotice organization={organization} />
      </DashboardBody>
    )
  }

  return (
    <DashboardBody wrapperClassName="max-w-(--breakpoint-md)!" title="Billing">
      <Box flexDirection="column" rowGap="3xl">
        <Section id="subscription">
          {subscriptionQuery.isLoading || !subscriptionQuery.data ? (
            <LoadingBox height={240} borderRadius="l" />
          ) : (
            <Box flexDirection="column" rowGap="xl">
              <StartupProgramCallout
                organization={organization}
                subscription={subscriptionQuery.data}
                plans={plansQuery.data ?? []}
              />
              <PastDueSubscriptionCallout
                subscription={subscriptionQuery.data}
              />
              <BillingSubscriptionCard
                subscription={subscriptionQuery.data}
                plans={plansQuery.data ?? []}
                onChangePlan={onChangePlan}
              />
            </Box>
          )}
        </Section>

        <BillingBenefitGrants organizationId={organization.id} />

        <Section id="payment-methods">
          <BillingPaymentMethods
            organizationId={organization.id}
            onAddPaymentMethod={onAddPaymentMethod}
            error={addPaymentMethodError}
          />
        </Section>

        <Section id="billing-address">
          <BillingAddressSection
            organizationId={organization.id}
            onEdit={showBillingAddress}
          />
        </Section>

        <Section id="orders">
          <SectionDescription
            title="Order history"
            description="Past invoices for your Polar subscription"
          />
          {ordersQuery.isLoading ? (
            <LoadingBox height={240} borderRadius="l" />
          ) : (
            <BillingOrdersTable
              organizationId={organization.id}
              orders={ordersQuery.data?.items ?? []}
            />
          )}
        </Section>
      </Box>

      <Modal
        title="Billing address"
        isShown={isBillingAddressOpen}
        hide={hideBillingAddress}
        modalContent={
          <BillingAddressModal
            organizationId={organization.id}
            hide={hideBillingAddress}
          />
        }
      />
    </DashboardBody>
  )
}
