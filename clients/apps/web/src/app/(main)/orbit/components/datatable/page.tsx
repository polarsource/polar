'use client'

import {
  Box,
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
  Text,
} from '@/components/Orbit'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { OrbitPageHeader, OrbitSectionHeader } from '../../OrbitPageHeader'

// ─── Demo data — flat transactions ───────────────────────────────────────────

type Transaction = {
  id: string
  date: string
  description: string
  amount: string
  status: 'completed' | 'pending' | 'failed'
}

const data: Transaction[] = [
  {
    id: 'TXN-001',
    date: 'Feb 18, 2026',
    description: 'Pro plan subscription',
    amount: '$49.00',
    status: 'completed',
  },
  {
    id: 'TXN-002',
    date: 'Feb 17, 2026',
    description: 'Usage overage charge',
    amount: '$12.40',
    status: 'completed',
  },
  {
    id: 'TXN-003',
    date: 'Feb 15, 2026',
    description: 'Add-on: analytics',
    amount: '$9.00',
    status: 'pending',
  },
  {
    id: 'TXN-004',
    date: 'Feb 12, 2026',
    description: 'Pro plan subscription',
    amount: '$49.00',
    status: 'completed',
  },
  {
    id: 'TXN-005',
    date: 'Feb 10, 2026',
    description: 'Refund — duplicate charge',
    amount: '-$49.00',
    status: 'completed',
  },
  {
    id: 'TXN-006',
    date: 'Feb 8, 2026',
    description: 'Enterprise seat upgrade',
    amount: '$199.00',
    status: 'failed',
  },
]

const statusColors: Record<Transaction['status'], string> = {
  completed: 'text-green-600 dark:text-green-400',
  pending: 'text-yellow-600 dark:text-yellow-400',
  failed: 'text-red-500 dark:text-red-400',
}

const columns: DataTableColumnDef<Transaction>[] = [
  {
    accessorKey: 'id',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="ID" />
    ),
    cell: ({ row }) => (
      <Text as="code" variant="subtle" fontFamily="mono" fontSize="xs">
        {row.getValue('id')}
      </Text>
    ),
    size: 120,
  },
  {
    accessorKey: 'date',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date" />
    ),
    size: 160,
  },
  {
    accessorKey: 'description',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Description" />
    ),
  },
  {
    accessorKey: 'amount',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Amount" />
    ),
    cell: ({ row }) => (
      <Text as="span" fontWeight="medium" tabular>{row.getValue('amount')}</Text>
    ),
    size: 120,
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const status: Transaction['status'] = row.getValue('status')
      return (
        <Text
          as="span"
          fontSize="xs"
          fontWeight="medium"
          transform="capitalize"
          className={statusColors[status]}
        >
          {status}
        </Text>
      )
    },
    size: 120,
  },
]

// ─── Demo data — expandable orders ───────────────────────────────────────────

type OrderRow = {
  id: string
  customer: string
  total: string
  items?: OrderRow[]
}

const orderData: OrderRow[] = [
  {
    id: 'ORD-101',
    customer: 'Acme Corp',
    total: '$148.00',
    items: [
      { id: '', customer: 'Pro plan × 1', total: '$49.00' },
      { id: '', customer: 'Analytics add-on × 3', total: '$27.00' },
      { id: '', customer: 'Storage 10 GB × 1', total: '$72.00' },
    ],
  },
  {
    id: 'ORD-102',
    customer: 'Globex Inc',
    total: '$49.00',
    items: [{ id: '', customer: 'Pro plan × 1', total: '$49.00' }],
  },
  {
    id: 'ORD-103',
    customer: 'Initech LLC',
    total: '$248.00',
    items: [
      { id: '', customer: 'Enterprise plan × 1', total: '$199.00' },
      { id: '', customer: 'Analytics add-on × 1', total: '$9.00' },
      { id: '', customer: 'Priority support × 1', total: '$40.00' },
    ],
  },
]

const orderColumns: DataTableColumnDef<OrderRow>[] = [
  {
    accessorKey: 'id',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Order" />
    ),
    cell: ({ row }) => (
      <div
        className="flex items-center gap-2"
        style={{ paddingLeft: `${row.depth * 20}px` }}
      >
        {row.getCanExpand() ? (
          <Box as="span" color="text-subtle">
            {row.getIsExpanded() ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </Box>
        ) : (
          <span className="w-3.5" />
        )}
        <Text as="code" variant="subtle" fontFamily="mono" fontSize="xs">
          {row.getValue('id') || '—'}
        </Text>
      </div>
    ),
    size: 140,
  },
  {
    accessorKey: 'customer',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Customer / Item" />
    ),
  },
  {
    accessorKey: 'total',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Total" />
    ),
    cell: ({ row }) => (
      <Text as="span" fontWeight="medium" tabular>{row.getValue('total')}</Text>
    ),
    size: 120,
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DataTablePage() {
  return (
    <Box display="flex" flexDirection="column" className="gap-20">
      <OrbitPageHeader
        label="Component"
        title="DataTable"
        description={
          <>
            A data grid built on{' '}
            <Text as="code" fontFamily="mono" fontSize="sm">@tanstack/react-table</Text>.
            Supports sortable columns, row selection, click handlers,
            pagination, expandable sub-rows, and loading states. Column
            definitions follow the standard TanStack{' '}
            <Text as="code" fontFamily="mono" fontSize="sm">ColumnDef</Text> API.
          </>
        }
      />

      {/* Basic */}
      <Box display="flex" flexDirection="column" gap={4}>
        <OrbitSectionHeader title="Basic" />
        <DataTable columns={columns} data={data} isLoading={false} />
      </Box>

      {/* Expandable rows */}
      <Box display="flex" flexDirection="column" gap={4}>
        <OrbitSectionHeader
          title="Expandable rows"
          description={
            <>
              Pass <Text as="code" fontFamily="mono" fontSize="xs">getSubRows</Text> to
              enable tree expansion. Toggle state lives in the row — use{' '}
              <Text as="code" fontFamily="mono" fontSize="xs">
                row.getToggleExpandedHandler()
              </Text>{' '}
              and <Text as="code" fontFamily="mono" fontSize="xs">row.depth</Text> to
              indent.
            </>
          }
        />
        <DataTable
          columns={orderColumns}
          data={orderData}
          isLoading={false}
          getSubRows={(row) => row.items}
          onRowClick={(row) => {
            if (row.getCanExpand()) row.getToggleExpandedHandler()()
          }}
        />
      </Box>

      {/* Loading */}
      <Box display="flex" flexDirection="column" gap={4}>
        <OrbitSectionHeader title="Loading state" />
        <DataTable columns={columns} data={[]} isLoading={true} />
      </Box>

      {/* Empty */}
      <Box display="flex" flexDirection="column" gap={4}>
        <OrbitSectionHeader title="Empty state" />
        <DataTable columns={columns} data={[]} isLoading={false} />
      </Box>

      {/* API */}
      <Box display="flex" flexDirection="column" gap={4}>
        <OrbitSectionHeader title="API" />
        <Box
          display="flex"
          flexDirection="column"
          className="dark:divide-polar-800 divide-y divide-neutral-200"
        >
          {[
            {
              name: 'columns',
              type: 'ColumnDef<TData, TValue>[]',
              desc: 'Column definitions. Use DataTableColumnDef<T> for convenience.',
            },
            { name: 'data', type: 'TData[]', desc: 'Row data array.' },
            {
              name: 'isLoading',
              type: 'boolean | ReactQueryLoading',
              desc: 'Shows a loading row. Accepts a TanStack Query result object directly.',
            },
            {
              name: 'getSubRows',
              type: '(row: TData) => TData[]',
              desc: 'Returns child rows. Enables tree expansion when provided.',
            },
            {
              name: 'pagination',
              type: 'PaginationState',
              desc: 'Controlled pagination state. Renders pagination controls when provided.',
            },
            {
              name: 'onPaginationChange',
              type: 'OnChangeFn<PaginationState>',
              desc: 'Called when page index or page size changes.',
            },
            {
              name: 'sorting',
              type: 'SortingState',
              desc: 'Controlled sort state.',
            },
            {
              name: 'onSortingChange',
              type: 'OnChangeFn<SortingState>',
              desc: 'Called when column sort changes.',
            },
            {
              name: 'onRowClick',
              type: '(row: Row<TData>) => void',
              desc: 'Makes rows clickable. Adds cursor-pointer.',
            },
            {
              name: 'enableRowSelection',
              type: 'boolean',
              desc: 'Enables row selection via checkbox or click.',
            },
          ].map(({ name, type, desc }) => (
            <Box key={name} className="grid grid-cols-5 gap-4 py-4">
              <Text as="code" fontFamily="mono" fontSize="sm">
                {name}
              </Text>
              <Text as="code" variant="subtle" fontFamily="mono" fontSize="xs" className="col-span-2">
                {type}
              </Text>
              <Text variant="subtle" fontSize="xs" className="col-span-2">
                {desc}
              </Text>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  )
}
