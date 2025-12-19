'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import FeatureSettings from '@/components/Settings/FeatureSettings'
import OrganizationAccessTokensSettings from '@/components/Settings/OrganizationAccessTokensSettings'
import OrganizationCustomerEmailSettings from '@/components/Settings/OrganizationCustomerEmailSettings'
import OrganizationCustomerPortalSettings from '@/components/Settings/OrganizationCustomerPortalSettings'
import OrganizationDeleteSettings from '@/components/Settings/OrganizationDeleteSettings'
import OrganizationNotificationSettings from '@/components/Settings/OrganizationNotificationSettings'
import OrganizationProfileSettings from '@/components/Settings/OrganizationProfileSettings'
import OrganizationSubscriptionSettings from '@/components/Settings/OrganizationSubscriptionSettings'
import { Section, SectionDescription } from '@/components/Settings/Section'
import { schemas } from '@polar-sh/client'

export default function ClientPage({
  organization: org,
}: {
  organization: schemas['Organization']
}) {
  return (
    <DashboardBody
      wrapperClassName="max-w-(--breakpoint-sm)!"
      title="Organization Settings"
    >
      <div className="flex flex-col gap-y-12">
        <Section id="organization">
          <SectionDescription title="Profile" />
          <OrganizationProfileSettings organization={org} />
        </Section>

        <Section id="subscriptions">
          <SectionDescription title="Subscriptions" />
          <OrganizationSubscriptionSettings organization={org} />
        </Section>

        <Section id="customer_portal">
          <SectionDescription title="Customer Portal" />
          <OrganizationCustomerPortalSettings organization={org} />
        </Section>

        <Section id="customer_emails">
          <SectionDescription title="Customer Emails" />
          <OrganizationCustomerEmailSettings organization={org} />
        </Section>

        <Section id="notifications">
          <SectionDescription title="Notifications" />
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
