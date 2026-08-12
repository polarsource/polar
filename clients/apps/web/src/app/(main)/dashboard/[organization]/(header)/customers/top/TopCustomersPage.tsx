'use client'

import { CustomerCell } from '@/components/Customer/CustomerCell'
import { CustomersPageShell } from '@/components/Customer/CustomersPageShell'
import { EmptyState } from '@/components/Shared/EmptyState'
import { useTopCustomers } from '@/hooks/queries'
import { useClientSidePagination } from '@/hooks/useClientSidePagination'
import { ChartRange, getChartRangeParams } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Alert, DataTable, DataTableColumnDef } from '@polar-sh/orbit'
import { TrendingUp } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

// Maximum accepted by the `/v1/customers/top` endpoint.
const LIMIT = 50

const columns: DataTableColumnDef<schemas['TopCustomer']>[] = [
  {
    accessorKey: 'name',
    enableSorting: false,
    header: 'Customer',
    cell: ({ row: { original: customer } }) => (
      <CustomerCell
        name={customer.name}
        email={customer.email}
        avatarUrl={customer.avatar_url}
      />
    ),
  },
  {
    accessorKey: 'order_count',
    enableSorting: false,
    header: 'Orders',
    cell: ({ getValue }) => (getValue() as number).toLocaleString(),
  },
  {
    accessorKey: 'net_revenue',
    enableSorting: false,
    header: 'Net Revenue',
    cell: ({ getValue }) =>
      formatCurrency('statistics')(getValue() as number, 'usd'),
  },
]

interface TopCustomersPageProps {
  organization: schemas['Organization']
}

export const TopCustomersPage = ({ organization }: TopCustomersPageProps) => {
  const router = useRouter()
  const [range, setRange] = useState<ChartRange>('30d')
  const [startDate, endDate] = useMemo(
    () => getChartRangeParams(range, organization.created_at),
    [range, organization.created_at],
  )

  const {
    data: topCustomers,
    isLoading,
    isError,
    refetch,
  } = useTopCustomers(organization.id, {
    start: startDate,
    end: endDate,
    limit: LIMIT,
  })

  const {
    pageItems,
    pagination,
    setPagination,
    resetPage,
    rowCount,
    pageCount,
  } = useClientSidePagination(topCustomers ?? [])

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
          title="Could not load top customers"
          actions={[{ text: 'Retry', onClick: () => refetch() }]}
        />
      ) : !isLoading && (topCustomers ?? []).length === 0 ? (
        <EmptyState
          icon={<TrendingUp />}
          title="No revenue yet"
          description="No paid orders were recorded in this period."
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
          getRowId={(customer) => customer.id}
          onRowClick={(row) =>
            router.push(
              `/dashboard/${organization.slug}/customers/${row.original.id}`,
            )
          }
        />
      )}
    </CustomersPageShell>
  )
}
