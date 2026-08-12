'use client'

import { CustomerCell } from '@/components/Customer/CustomerCell'
import { CustomersPageShell } from '@/components/Customer/CustomersPageShell'
import { EmptyState } from '@/components/Shared/EmptyState'
import { CustomerStatItem, useEventCustomerStats } from '@/hooks/queries/events'
import { useClientSidePagination } from '@/hooks/useClientSidePagination'
import { ChartRange, getChartRangeParams, toISODate } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Alert, DataTable, DataTableColumnDef } from '@polar-sh/orbit'
import { Coins } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

const LIMIT = 200

const cost = (stat: CustomerStatItem) =>
  parseFloat(String(stat.totals?.['_cost_amount'] ?? '0'))

const columns: DataTableColumnDef<CustomerStatItem>[] = [
  {
    id: 'customer',
    enableSorting: false,
    header: 'Customer',
    cell: ({ row: { original: stat } }) => (
      <CustomerCell
        name={stat.name ?? stat.external_customer_id}
        email={stat.email}
      />
    ),
  },
  {
    accessorKey: 'occurrences',
    enableSorting: false,
    header: 'Events',
    cell: ({ getValue }) => (getValue() as number).toLocaleString(),
  },
  {
    accessorKey: 'share',
    enableSorting: false,
    header: 'Share of Costs',
    cell: ({ getValue }) => `${Math.round((getValue() as number) * 100)}%`,
  },
  {
    id: 'cost',
    enableSorting: false,
    header: 'Cost',
    cell: ({ row: { original: stat } }) =>
      formatCurrency('subcent')(cost(stat), 'usd'),
  },
]

interface CostDriversPageProps {
  organization: schemas['Organization']
}

export const CostDriversPage = ({ organization }: CostDriversPageProps) => {
  const router = useRouter()
  const [range, setRange] = useState<ChartRange>('30d')
  const [startDate, endDate] = useMemo(
    () => getChartRangeParams(range, organization.created_at),
    [range, organization.created_at],
  )

  const { data, isLoading, isError, refetch } = useEventCustomerStats(
    organization.id,
    {
      start_date: toISODate(startDate),
      end_date: toISODate(endDate),
      aggregate_fields: ['_cost.amount'],
      limit: LIMIT,
    },
  )

  const stats = useMemo(
    () => (data?.items ?? []).filter((stat) => cost(stat) > 0),
    [data],
  )

  const {
    pageItems,
    pagination,
    setPagination,
    resetPage,
    rowCount,
    pageCount,
  } = useClientSidePagination(stats)

  return (
    <CustomersPageShell
      organization={organization}
      range={range}
      onRangeChange={(value) => {
        setRange(value)
        resetPage()
      }}
    >
      {isError ? (
        <Alert
          variant="danger"
          title="Could not load cost statistics"
          actions={[{ text: 'Retry', onClick: () => refetch() }]}
        />
      ) : !isLoading && stats.length === 0 ? (
        <EmptyState
          icon={<Coins />}
          title="No cost data"
          description="Costs come from _cost metadata on ingested events."
        />
      ) : (
        <DataTable
          columns={columns}
          data={pageItems}
          isLoading={isLoading}
          rowCount={rowCount}
          pageCount={pageCount}
          pagination={pagination}
          onPaginationChange={setPagination}
          getRowId={(stat, index) =>
            stat.customer_id ?? stat.external_customer_id ?? String(index)
          }
          onRowClick={(row) => {
            if (row.original.customer_id) {
              router.push(
                `/dashboard/${organization.slug}/customers/${row.original.customer_id}`,
              )
            }
          }}
        />
      )}
    </CustomersPageShell>
  )
}
