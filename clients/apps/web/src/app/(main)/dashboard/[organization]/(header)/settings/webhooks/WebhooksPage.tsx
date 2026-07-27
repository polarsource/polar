'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import WebhookSettings from '@/components/Settings/Webhook/WebhookSettings'
import { schemas } from '@polar-sh/client'

export default function ClientPage({
  organization: org,
}: {
  organization: schemas['Organization']
}) {
  return (
    <DashboardBody title="Webhooks">
      <WebhookSettings org={org} />
    </DashboardBody>
  )
}
