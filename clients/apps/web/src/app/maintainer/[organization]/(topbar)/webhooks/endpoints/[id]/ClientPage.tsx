'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import {
  DataTablePaginationState,
  DataTableSortingState,
} from '@/utils/datatable'
import { Organization, WebhookEndpoint } from '@polar-sh/sdk'
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

        <pre>{JSON.stringify(endpoint, undefined, 2)}</pre>

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
