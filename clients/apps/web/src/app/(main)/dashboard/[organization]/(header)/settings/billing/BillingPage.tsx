'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { BillingOrdersTable } from '@/components/Settings/Billing/BillingOrdersTable'
import { BillingSubscriptionCard } from '@/components/Settings/Billing/BillingSubscriptionCard'
import { MOCK_ORDERS } from '@/components/Settings/Billing/mockData'
import {
  useOrganizationPlans,
  useOrganizationSubscription,
} from '@/hooks/queries/billing'
import { Section, SectionDescription } from '@/components/Settings/Section'
import { LoadingBox } from '@/components/Shared/LoadingBox'
import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import AllInclusive from '@mui/icons-material/AllInclusive'
import { useRouter } from 'next/navigation'
import { EmptyState } from '@/components/CustomerPortal/EmptyState'

export default function BillingPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const router = useRouter()
  const subscriptionQuery = useOrganizationSubscription(organization.id)
  const plansQuery = useOrganizationPlans(organization.id)

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

        <Section id="orders">
          <SectionDescription
            title="Order history"
            description="Past invoices for your Polar subscription"
          />
          <BillingOrdersTable orders={MOCK_ORDERS} />
        </Section>
      </Box>
    </DashboardBody>
  )
}
