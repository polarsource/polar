'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { EmptyState } from '@/components/CustomerPortal/EmptyState'
import { Modal } from '@/components/Modal'
import { useModal } from '@/components/Modal/useModal'
import { AddBillingPaymentMethodModal } from '@/components/Settings/Billing/AddBillingPaymentMethodModal'
import { BillingAddressModal } from '@/components/Settings/Billing/BillingAddressModal'
import { BillingAddressSection } from '@/components/Settings/Billing/BillingAddressSection'
import { BillingOrdersTable } from '@/components/Settings/Billing/BillingOrdersTable'
import { BillingPaymentMethods } from '@/components/Settings/Billing/BillingPaymentMethods'
import { BillingSubscriptionCard } from '@/components/Settings/Billing/BillingSubscriptionCard'
import { Section, SectionDescription } from '@/components/Settings/Section'
import { LoadingBox } from '@/components/Shared/LoadingBox'
import {
  useOrganizationOrders,
  useOrganizationPlans,
  useOrganizationSubscription,
} from '@/hooks/queries/billing'
import AllInclusive from '@mui/icons-material/AllInclusive'
import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import { getThemePreset } from '@polar-sh/ui/hooks/theming'
import { useQueryClient } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'

export default function BillingPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const theme = useTheme()
  const themePreset = getThemePreset(theme.resolvedTheme as 'light' | 'dark')

  const subscriptionQuery = useOrganizationSubscription(organization.id)
  const plansQuery = useOrganizationPlans(organization.id)
  const ordersQuery = useOrganizationOrders(organization.id)

  useEffect(() => {
    if (searchParams.get('checkout_success') !== 'true') return
    queryClient.invalidateQueries({
      queryKey: ['organization-billing', organization.id],
    })
    router.replace(`/dashboard/${organization.slug}/settings/billing`)
  }, [searchParams, queryClient, organization.id, organization.slug, router])

  const {
    isShown: isAddPaymentMethodOpen,
    show: showAddPaymentMethod,
    hide: hideAddPaymentMethod,
  } = useModal()

  const {
    isShown: isBillingAddressOpen,
    show: showBillingAddress,
    hide: hideBillingAddress,
  } = useModal()

  const onChangePlan = () => {
    router.push(`/dashboard/${organization.slug}/settings/billing/change-plan`)
  }

  return (
    <DashboardBody wrapperClassName="max-w-(--breakpoint-md)!" title="Billing">
      <Box display="flex" flexDirection="column" rowGap="3xl">
        <Section id="subscription">
          {subscriptionQuery.isLoading ? (
            <LoadingBox height={240} borderRadius="l" />
          ) : subscriptionQuery.data ? (
            <BillingSubscriptionCard
              subscription={subscriptionQuery.data}
              plans={plansQuery.data ?? []}
              onChangePlan={onChangePlan}
            />
          ) : (
            <EmptyState
              icon={<AllInclusive fontSize="medium" />}
              title="No active subscription"
              description="This organization doesn't have an active subscription"
              actions={[
                {
                  children: 'Select Plan',
                  onClick: onChangePlan,
                },
              ]}
            />
          )}
        </Section>

        <Section id="payment-methods">
          <BillingPaymentMethods
            organizationId={organization.id}
            onAddPaymentMethod={showAddPaymentMethod}
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
        title="Add payment method"
        isShown={isAddPaymentMethodOpen}
        hide={hideAddPaymentMethod}
        modalContent={
          <AddBillingPaymentMethodModal
            organizationId={organization.id}
            onPaymentMethodAdded={hideAddPaymentMethod}
            hide={hideAddPaymentMethod}
            themePreset={themePreset}
          />
        }
      />

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
