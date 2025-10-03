'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import OrganizationAccessTokensSettings from '@/components/Settings/OrganizationAccessTokensSettings'
import OrganizationNotificationSettings from '@/components/Settings/OrganizationNotificationSettings'
import OrganizationProfileSettings from '@/components/Settings/OrganizationProfileSettings'
import OrganizationSubscriptionSettings from '@/components/Settings/OrganizationSubscriptionSettings'
import { Section, SectionDescription } from '@/components/Settings/Section'
import { schemas } from '@polar-sh/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function ClientPage({
  organization: initialOrganization,
}: {
  organization: schemas['Organization']
}) {
  const router = useRouter()
  const [org, setOrg] = useState<schemas['Organization']>(initialOrganization)

  const handleOrganizationUpdate = (
    updatedOrganization: schemas['Organization'],
  ) => {
    setOrg(updatedOrganization)

    if (initialOrganization.slug !== updatedOrganization.slug) {
      const newPath = `/dashboard/${updatedOrganization.slug}/settings`
      router.replace(newPath)
    }
  }

  return (
    <DashboardBody
      wrapperClassName="max-w-(--breakpoint-sm)!"
      title="Organization Settings"
    >
      <div className="flex flex-col gap-y-12">
        <Section id="organization">
          <SectionDescription title="Profile" />
          <OrganizationProfileSettings
            organization={org}
            onOrganizationUpdated={handleOrganizationUpdate}
          />
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
