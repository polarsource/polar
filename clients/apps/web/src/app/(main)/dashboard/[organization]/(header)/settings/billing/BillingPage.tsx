'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
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
    <DashboardBody
      wrapperClassName="max-w-(--breakpoint-sm)!"
      title="Billing Settings"
    >
      <div className="flex flex-col gap-y-12">
        <Section id="subscriptions">
          <SectionDescription title="Subscriptions" />
          <OrganizationSubscriptionSettings organization={org} />
        </Section>

        <Section id="customer_portal">
          <SectionDescription title="Customer Portal" />
          <OrganizationCustomerPortalSettings organization={org} />
        </Section>

        <Section id="customer_emails">
          <SectionDescription
            title="Emails to Customers"
            description="Transactional emails sent to customers after purchases and subscription events"
          />
          <OrganizationCustomerEmailSettings organization={org} />
        </Section>
      </div>
    </DashboardBody>
  )
}
