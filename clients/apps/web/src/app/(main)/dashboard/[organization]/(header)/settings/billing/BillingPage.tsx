'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { BillingOrdersTable } from '@/components/Settings/Billing/BillingOrdersTable'
import { BillingSubscriptionCard } from '@/components/Settings/Billing/BillingSubscriptionCard'
import {
  MOCK_ORDERS,
  getPlanById,
} from '@/components/Settings/Billing/mockData'
import { useBillingSubscription } from '@/components/Settings/Billing/useBillingStore'
import { Section, SectionDescription } from '@/components/Settings/Section'
import { schemas } from '@polar-sh/client'
import { useRouter } from 'next/navigation'

export default function BillingPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const router = useRouter()
  const subscription = useBillingSubscription()
  const plan = getPlanById(subscription.planId)

  const onChangePlan = () => {
    router.push(`/dashboard/${organization.slug}/settings/billing/change-plan`)
  }

  return (
    <DashboardBody wrapperClassName="max-w-(--breakpoint-md)!" title="Billing">
      <div className="flex flex-col gap-y-12">
        <Section id="subscription">
          <SectionDescription
            title="Subscription"
            description={`Your active Polar subscription for ${organization.name}. Change plan to upgrade or downgrade at any time.`}
          />
          <BillingSubscriptionCard
            subscription={subscription}
            plan={plan}
            onChangePlan={onChangePlan}
          />
        </Section>

        <Section id="orders">
          <SectionDescription
            title="Order history"
            description="Past invoices for your Polar subscription"
          />
          <BillingOrdersTable orders={MOCK_ORDERS} />
        </Section>
      </div>
    </DashboardBody>
  )
}
