'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import {
  DataTablePaginationState,
  DataTableSortingState,
} from '@/utils/datatable'
import { Organization } from '@polar-sh/sdk'
import DeliveriesTable from './DeliveriesTable'

export default function ClientPage({
  organization,
  pagination,
  sorting,
}: {
  organization: Organization
  pagination: DataTablePaginationState
  sorting: DataTableSortingState
}) {
  return (
    <DashboardBody>
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl">Overview</h2>
        </div>

        <DeliveriesTable
          pagination={pagination}
          sorting={sorting}
          organization={organization}
        />
      </div>
    </DashboardBody>
  )
}
