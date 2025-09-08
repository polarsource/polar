'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import WebhookSettings from '@/components/Settings/Webhook/WebhookSettings'
import { WebhookFilter, WebhookFilterState } from '@/components/Settings/Webhook/WebhookFilter'
import { schemas } from '@polar-sh/client'
import { useState } from 'react'

export default function ClientPage({
  organization: org,
}: {
  organization: schemas['Organization']
}) {
  const [filters, setFilters] = useState<WebhookFilterState>({})

  const handleFilterChange = (newFilters: WebhookFilterState) => {
    setFilters(newFilters)
  }

  return (
    <DashboardBody
      title="Webhooks"
      header={
        <WebhookFilter
          onFilterChange={handleFilterChange}
          initialFilters={filters}
        />
      }
      wide
    >
      <WebhookSettings org={org} />
    </DashboardBody>
  )
}
