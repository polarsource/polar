'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { Section, SectionDescription } from '@/components/Settings/Section'
import WebhookNotificationSettings from '@/components/Settings/Webhook/WebhookNotificationSettings'
import WebhookSettings from '@/components/Settings/Webhook/WebhookSettings'
import Spinner from '@/components/Shared/Spinner'
import { useCurrentOrgAndRepoFromURL } from '@/hooks/org'
import { redirect } from 'next/navigation'

export default function ClientPage() {
  const { org, isLoaded } = useCurrentOrgAndRepoFromURL()

  if (org?.is_personal) {
    redirect('/settings')
  }

  if (!isLoaded || !org) {
    return (
      <DashboardBody>
        <Spinner />
      </DashboardBody>
    )
  }

  return (
    <DashboardBody>
      <div className="dark:divide-polar-700 divide-y divide-gray-200">
        <Section>
          <SectionDescription
            title="Discord + Slack Notifications"
            description={`Send a incoming webhook to Discord or Slack when ${org.name} receives a new pledge`}
          />
          <WebhookNotificationSettings org={org} />
        </Section>
        <Section>
          <SectionDescription
            title="Webhooks"
            description={`Configure and send webhooks to custom URLs.`}
          />

          <WebhookSettings org={org} />
        </Section>
      </div>
    </DashboardBody>
  )
}
