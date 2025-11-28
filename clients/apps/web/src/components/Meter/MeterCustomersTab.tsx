'use client'

import { useCustomerMeters } from '@/hooks/queries/customerMeters'
import { getAPIParams } from '@/utils/datatable'
import { schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import {
  DataTable,
  DataTableColumnHeader,
} from '@polar-sh/ui/components/atoms/DataTable'
import {
  DataTablePaginationState,
  DataTableSortingState,
} from '@polar-sh/ui/components/atoms/datatable/DataTable'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import Link from 'next/link'
import { useState } from 'react'
import FormattedUnits from './FormattedUnits'

const MeterCustomersTab = ({
  meter,
  organization,
}: {
  meter: schemas['Meter']
  organization: schemas['Organization']
}) => {
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })
  const [sorting, setSorting] = useState<DataTableSortingState>([
    {
      id: 'modified_at',
      desc: true,
    },
  ])
  const { data: customerMeters, isLoading } = useCustomerMeters(
    meter.organization_id,
    {
      ...getAPIParams(pagination, sorting),
      meter_id: meter.id,
    },
  )
  return (
    <DataTable
      isLoading={isLoading}
      data={customerMeters?.items ?? []}
      pagination={pagination}
      onPaginationChange={setPagination}
      rowCount={customerMeters?.pagination.total_count ?? 0}
      pageCount={customerMeters?.pagination.max_page ?? 1}
      sorting={sorting}
      onSortingChange={setSorting}
      columns={[
        {
          header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Customer" />
          ),
          accessorKey: 'customer',
          cell: ({
            cell: {
              row: {
                original: { customer },
              },
            },
          }) => (
            <Link
              href={`/dashboard/${organization.slug}/customers/${customer.id}`}
              className="flex items-center gap-x-3"
            >
              <Avatar
                className="dark:bg-polar-900 text-xxs h-8 w-8 bg-white"
                name={customer.name ?? customer.email ?? '—'}
                avatar_url={customer.avatar_url ?? null}
              />
              <div className="flex flex-col">
                <span className="text-xs">{customer.name ?? '—'}</span>
                <span className="dark:text-polar-500 text-xxs text-gray-500">
                  {customer.email ?? '—'}
                </span>
              </div>
            </Link>
          ),
        },
        {
          header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Updated At" />
          ),
          accessorKey: 'modified_at',
          cell: ({
            cell: {
              row: {
                original: { modified_at },
              },
            },
          }) =>
            modified_at ? (
              <FormattedDateTime
                dateStyle="short"
                timeStyle="medium"
                resolution="time"
                datetime={modified_at}
              />
            ) : (
              '—'
            ),
        },
        {
          header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Consumed Units" />
          ),
          accessorKey: 'consumed_units',
          cell: ({
            cell: {
              row: {
                original: { consumed_units },
              },
            },
          }) => <FormattedUnits value={consumed_units} />,
        },
        {
          header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Credited Units" />
          ),
          accessorKey: 'credited_units',
          cell: ({
            cell: {
              row: {
                original: { credited_units },
              },
            },
          }) => <FormattedUnits value={credited_units} />,
        },
        {
          header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Balance" />
          ),
          accessorKey: 'balance',
          cell: ({
            cell: {
              row: {
                original: { balance },
              },
            },
          }) => <FormattedUnits value={balance} />,
        },
      ]}
    />
  )
}

export default MeterCustomersTab
