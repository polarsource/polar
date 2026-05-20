'use client'

import AccessRestricted from '@/components/Finance/AccessRestricted'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import WebhookSettings from '@/components/Settings/Webhook/WebhookSettings'
import { useHasPermission } from '@/hooks/permissions'
import { schemas } from '@polar-sh/client'

export default function ClientPage({
  organization: org,
}: {
  organization: schemas['Organization']
}) {
  const canManageWebhooks = useHasPermission(org.id, 'organization:manage')

  if (canManageWebhooks === false) {
    return (
      <DashboardBody title="Webhooks">
        <AccessRestricted message="You don't have permission to manage webhooks for this organization. Ask an admin if you need access." />
      </DashboardBody>
    )
  }

  return (
    <DashboardBody title="Webhooks">
      <WebhookSettings org={org} />
    </DashboardBody>
  )
}
