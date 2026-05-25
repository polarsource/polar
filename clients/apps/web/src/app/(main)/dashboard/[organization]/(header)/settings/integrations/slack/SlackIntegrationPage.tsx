'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { SlackIntegrationSettings } from '@/components/Settings/SlackIntegrationSettings'
import { schemas } from '@polar-sh/client'

export default function SlackIntegrationPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  return (
    <DashboardBody title="Slack integration">
      <SlackIntegrationSettings organization={organization} />
    </DashboardBody>
  )
}
