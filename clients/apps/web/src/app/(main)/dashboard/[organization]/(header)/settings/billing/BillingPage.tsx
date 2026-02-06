'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import OrganizationCurrencySettings from '@/components/Settings/OrganizationCurrencySettings'
import OrganizationCustomerEmailSettings from '@/components/Settings/OrganizationCustomerEmailSettings'
import OrganizationCustomerPortalSettings from '@/components/Settings/OrganizationCustomerPortalSettings'
import OrganizationSubscriptionSettings from '@/components/Settings/OrganizationSubscriptionSettings'
import { Section, SectionDescription } from '@/components/Settings/Section'
import { schemas } from '@polar-sh/client'

export default function BillingPage({
  organization: org,
}: {
  organization: schemas['Organization']
}) {
  return (
    <DashboardBody wrapperClassName="max-w-(--breakpoint-sm)!" title="Billing">
      <div className="flex flex-col gap-y-12">
        <Section id="currency">
          <SectionDescription title="Currency" />
          <OrganizationCurrencySettings organization={org} />
        </Section>

        <Section id="subscriptions">
          <SectionDescription title="Subscriptions" />
          <OrganizationSubscriptionSettings organization={org} />
        </Section>

        <Section id="customer_portal">
          <SectionDescription title="Customer portal" />
          <OrganizationCustomerPortalSettings organization={org} />
        </Section>

        <Section id="customer_emails">
          <SectionDescription
            title="Customer notifications"
            description="Emails automatically sent to customers for purchases, renewals, and other subscription lifecycle events"
          />
          <OrganizationCustomerEmailSettings organization={org} />
        </Section>
      </div>
    </DashboardBody>
  )
}
