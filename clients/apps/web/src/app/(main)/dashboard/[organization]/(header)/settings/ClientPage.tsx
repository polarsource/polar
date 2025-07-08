'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import OrganizationAccessTokensSettings from '@/components/Settings/OrganizationAccessTokensSettings'
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
      wrapperClassName="!max-w-screen-sm"
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

        <Section id="notifications">
          <SectionDescription title="Notifications" />
          <OrganizationNotificationSettings organization={org} />
        </Section>

        <Section id="developers">
          <SectionDescription
            title="Developers"
            description="Manage access tokens to authenticate with the Polar API"
          />
          <OrganizationAccessTokensSettings organization={org} />
        </Section>
      </div>
    </DashboardBody>
  )
}
