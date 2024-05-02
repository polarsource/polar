'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import {
  DataTablePaginationState,
  DataTableSortingState,
} from '@/utils/datatable'
import { Organization, WebhookEndpoint } from '@polar-sh/sdk'
import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'
import { Checkbox } from 'polarkit/components/ui/checkbox'
import DeliveriesTable from './DeliveriesTable'

export default function ClientPage({
  organization,
  endpoint,
  pagination,
  sorting,
}: {
  organization: Organization
  endpoint: WebhookEndpoint
  pagination: DataTablePaginationState
  sorting: DataTableSortingState
}) {
  return (
    <DashboardBody>
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl">Webhook deliveries</h2>
        </div>

        <div>
          <h3>Endpoint</h3>
          <pre className="text-gray-600">{endpoint.url}</pre>
        </div>

        <div>
          <h3>Events</h3>

          <div className="flex flex-col space-y-2">
            {endpoint.events.length > 0 ? (
              <>
                {endpoint.events.map((event) => (
                  <div
                    className="flex flex-row items-center space-x-3 space-y-0"
                    key={event}
                  >
                    <Checkbox checked={true} disabled={true} />
                    <span className="text-sm leading-none">{event}</span>
                  </div>
                ))}
              </>
            ) : (
              <span>This endpoint is not subscribing to any events</span>
            )}
          </div>
        </div>

        <Link
          href={`/maintainer/${organization.name}/webhooks/endpoints/${endpoint.id}/edit`}
          className="shrink-0"
        >
          <Button size={'sm'} asChild variant={'outline'}>
            Edit
          </Button>
        </Link>

        <DeliveriesTable
          endpoint={endpoint}
          pagination={pagination}
          sorting={sorting}
          organization={organization}
        />
      </div>
    </DashboardBody>
  )
}
