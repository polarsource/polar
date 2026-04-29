'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import OrganizationPaymentSettings from '@/components/Settings/OrganizationPaymentSettings'
import OrganizationCustomerEmailSettings from '@/components/Settings/OrganizationCustomerEmailSettings'
import OrganizationCustomerPortalSettings from '@/components/Settings/OrganizationCustomerPortalSettings'
import OrganizationSubscriptionSettings from '@/components/Settings/OrganizationSubscriptionSettings'
import { Section, SectionDescription } from '@/components/Settings/Section'
import { CONFIG } from '@/utils/config'
import { schemas } from '@polar-sh/client'
import Alert from '@polar-sh/ui/components/atoms/Alert'
import Link from 'next/link'

export default function BillingPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  return (
    <DashboardBody wrapperClassName="max-w-(--breakpoint-sm)!" title="Billing">
      <div className="flex flex-col gap-y-12">
        <Section id="payments">
          <SectionDescription title="Payments" />
          <OrganizationPaymentSettings organization={organization} />
        </Section>

        <Section id="subscriptions">
          <SectionDescription title="Subscriptions" />
          <OrganizationSubscriptionSettings organization={organization} />
        </Section>

        <Section id="customer_portal">
          <SectionDescription title="Customer portal" />
          <OrganizationCustomerPortalSettings organization={organization} />
        </Section>

        <Section id="customer_emails">
          <SectionDescription
            title="Customer notifications"
            description="Emails automatically sent to customers for purchases, renewals, and other subscription lifecycle events"
          />
          {CONFIG.IS_SANDBOX && (
            <Alert color="yellow" className="p-3 px-4 text-sm">
              In sandbox, customer-facing emails are only delivered to{' '}
              <Link
                href="./members"
                className="font-medium underline hover:no-underline"
              >
                members of your organization
              </Link>
              . Sub-addressing aliases like{' '}
              <strong className="font-medium">you+test@example.com</strong> are
              accepted.
            </Alert>
          )}
          <OrganizationCustomerEmailSettings organization={organization} />
        </Section>
      </div>
    </DashboardBody>
  )
}
