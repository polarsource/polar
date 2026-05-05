'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import FeatureSettings from '@/components/Settings/FeatureSettings'
import OrganizationAccessTokensSettings from '@/components/Settings/OrganizationAccessTokensSettings'
import OrganizationCustomerEmailSettings from '@/components/Settings/OrganizationCustomerEmailSettings'
import OrganizationCustomerPortalSettings from '@/components/Settings/OrganizationCustomerPortalSettings'
import OrganizationDeleteSettings from '@/components/Settings/OrganizationDeleteSettings'
import OrganizationNotificationSettings from '@/components/Settings/OrganizationNotificationSettings'
import OrganizationPaymentSettings from '@/components/Settings/OrganizationPaymentSettings'
import OrganizationProfileSettings from '@/components/Settings/OrganizationProfileSettings'
import OrganizationSubscriptionSettings from '@/components/Settings/OrganizationSubscriptionSettings'
import { Section, SectionDescription } from '@/components/Settings/Section'
import { CONFIG } from '@/utils/config'
import { schemas } from '@polar-sh/client'
import Alert from '@polar-sh/ui/components/atoms/Alert'
import Link from 'next/link'

export default function ClientPage({
  organization: org,
}: {
  organization: schemas['Organization']
}) {
  return (
    <DashboardBody
      wrapperClassName="max-w-(--breakpoint-sm)!"
      title="Preferences"
    >
      <div className="flex flex-col gap-y-12">
        <Section id="organization">
          <SectionDescription title="Organization" />
          <OrganizationProfileSettings organization={org} />
        </Section>

        <Section id="payments">
          <SectionDescription title="Payments" />
          <OrganizationPaymentSettings organization={org} />
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
          <OrganizationCustomerEmailSettings organization={org} />
        </Section>

        <Section id="account-notifications">
          <SectionDescription
            title="Account notifications"
            description="Emails sent to members of your organization for account and product activity"
          />
          <OrganizationNotificationSettings organization={org} />
        </Section>

        <Section id="features">
          <SectionDescription
            title="Features"
            description="Manage alpha & beta features for your organization"
          />
          <FeatureSettings organization={org} />
        </Section>

        <Section id="developers">
          <SectionDescription
            title="Developers"
            description="Manage access tokens to authenticate with the Polar API"
          />
          <OrganizationAccessTokensSettings organization={org} />
        </Section>

        <Section id="danger">
          <SectionDescription
            title="Danger Zone"
            description="Irreversible actions for this organization"
          />
          <OrganizationDeleteSettings organization={org} />
        </Section>
      </div>
    </DashboardBody>
  )
}
