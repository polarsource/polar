'use client'

import {
  DataTable,
  DataTableColumnHeader,
  Status,
  Text,
  type DataTableColumnDef,
  type DataTablePaginationState,
  type DataTableSortingState,
  type StatusColor,
} from '@polar-sh/orbit'
import { useMemo, useState } from 'react'

interface Order {
  id: string
  customer: string
  email: string
  amount: number
  status: 'paid' | 'pending' | 'refunded'
}

const ORDERS: Order[] = [
  {
    id: 'ord_01',
    customer: 'Acme AI',
    email: 'ops@acme.ai',
    amount: 4900,
    status: 'paid',
  },
  {
    id: 'ord_02',
    customer: 'Nimbus Labs',
    email: 'billing@nimbus.dev',
    amount: 1200,
    status: 'pending',
  },
  {
    id: 'ord_03',
    customer: 'Quanta',
    email: 'finance@quanta.io',
    amount: 9900,
    status: 'paid',
  },
  {
    id: 'ord_04',
    customer: 'Helix',
    email: 'team@helix.sh',
    amount: 2500,
    status: 'refunded',
  },
  {
    id: 'ord_05',
    customer: 'Orbit Tools',
    email: 'hi@orbit.tools',
    amount: 7300,
    status: 'paid',
  },
  {
    id: 'ord_06',
    customer: 'Vector',
    email: 'pay@vector.ai',
    amount: 1800,
    status: 'pending',
  },
  {
    id: 'ord_07',
    customer: 'Drift',
    email: 'accounts@drift.app',
    amount: 6400,
    status: 'paid',
  },
  {
    id: 'ord_08',
    customer: 'Pulse',
    email: 'billing@pulse.co',
    amount: 3100,
    status: 'refunded',
  },
]

const statusColor: Record<Order['status'], StatusColor> = {
  paid: 'green',
  pending: 'yellow',
  refunded: 'gray',
}

const formatAmount = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    cents / 100,
  )

const columns: DataTableColumnDef<Order>[] = [
  {
    accessorKey: 'customer',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Customer" />
    ),
    cell: ({ row }) => <Text>{row.original.customer}</Text>,
  },
  {
    accessorKey: 'email',
    enableSorting: false,
    header: 'Email',
    cell: ({ row }) => <Text color="muted">{row.original.email}</Text>,
  },
  {
    accessorKey: 'amount',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Amount" />
    ),
    cell: ({ row }) => (
      <Text variant="mono">{formatAmount(row.original.amount)}</Text>
    ),
  },
  {
    accessorKey: 'status',
    enableSorting: false,
    header: 'Status',
    cell: ({ row }) => (
      <Status
        status={row.original.status}
        color={statusColor[row.original.status]}
        size="small"
      />
    ),
  },
]

export function OrdersTableDemo() {
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })
  const [sorting, setSorting] = useState<DataTableSortingState>([])

  const sorted = useMemo(() => {
    const sort = sorting[0]
    if (!sort) return ORDERS
    const rows = [...ORDERS]
    rows.sort((a, b) => {
      const key = sort.id as keyof Order
      if (a[key] < b[key]) return sort.desc ? 1 : -1
      if (a[key] > b[key]) return sort.desc ? -1 : 1
      return 0
    })
    return rows
  }, [sorting])

  const page = useMemo(() => {
    const start = pagination.pageIndex * pagination.pageSize
    return sorted.slice(start, start + pagination.pageSize)
  }, [sorted, pagination])

  return (
    <DataTable
      columns={columns}
      data={page}
      rowCount={ORDERS.length}
      isLoading={false}
      pagination={pagination}
      onPaginationChange={setPagination}
      sorting={sorting}
      onSortingChange={setSorting}
    />
  )
}
