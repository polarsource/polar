'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import OrganizationAppearanceSettings from '@/components/Settings/OrganizationAppearanceSettings'
import { Section, SectionDescription } from '@/components/Settings/Section'
import WebhookSettings from '@/components/Settings/Webhook/WebhookSettings'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { useContext } from 'react'

export default function ClientPage() {
  const { organization: org } = useContext(MaintainerOrganizationContext)

  return (
    <DashboardBody>
      <div className="dark:divide-polar-700 divide-y divide-gray-200">
        <Section>
          <SectionDescription
            title="Appearance"
            description="Configure how your organization appears to the public"
          />
          <OrganizationAppearanceSettings organization={org} />
        </Section>
        <Section>
          <SectionDescription
            title="Webhooks"
            description={`Configure and send webhooks to custom URLs, Discord or Slack.`}
          />

          <WebhookSettings org={org} />
        </Section>
      </div>
    </DashboardBody>
  )
}
