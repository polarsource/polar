'use client'

import { Timeline } from '@/components/Timeline/Timeline'
import { useHasPermission } from '@/hooks/permissions'
import { schemas } from '@polar-sh/client'
import { SegmentedControl } from '@polar-sh/orbit'
import { useState } from 'react'
import { ContextCard } from '../Shared/ContextCard'

type SourceFilter = 'system' | 'all'

interface CustomerTimelineProps {
  organization: schemas['Organization']
  customer:
    | schemas['Customer']
    | schemas['OrderCustomer']
    | schemas['SubscriptionCustomer']
}

export const CustomerTimeline = ({
  organization,
  customer,
}: CustomerTimelineProps) => {
  const allowed = useHasPermission(organization.id, 'analytics:read')
  const [source, setSource] = useState<SourceFilter>('all')

  if (!allowed) {
    return null
  }

  return (
    <ContextCard>
      <div className="flex flex-row items-center justify-between gap-2">
        <h3 className="text-lg">Timeline</h3>
        <SegmentedControl<SourceFilter>
          size="sm"
          options={[
            { value: 'system', label: 'System' },
            { value: 'all', label: 'All' },
          ]}
          value={source}
          onChange={setSource}
        />
      </div>
      <div className="-mx-3 flex max-h-96 flex-col overflow-y-auto px-3">
        <Timeline
          organizationId={organization.id}
          organizationSlug={organization.slug}
          customerId={customer.id}
          source={source === 'system' ? 'system' : undefined}
          limit={20}
          viewAllHref={`/dashboard/${organization.slug}/analytics/events?customerIds=${customer.id}`}
          emptyMessage="Events from this customer will appear here."
        />
      </div>
    </ContextCard>
  )
}
