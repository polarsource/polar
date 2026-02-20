'use client'

import {
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
} from '@/components/Orbit'
import { OrbitPageHeader, OrbitSectionHeader } from '../../OrbitPageHeader'
import { ChevronDown, ChevronRight } from 'lucide-react'

// ─── Demo data — flat transactions ───────────────────────────────────────────

type Transaction = {
  id: string
  date: string
  description: string
  amount: string
  status: 'completed' | 'pending' | 'failed'
}

const data: Transaction[] = [
  { id: 'TXN-001', date: 'Feb 18, 2026', description: 'Pro plan subscription', amount: '$49.00', status: 'completed' },
  { id: 'TXN-002', date: 'Feb 17, 2026', description: 'Usage overage charge', amount: '$12.40', status: 'completed' },
  { id: 'TXN-003', date: 'Feb 15, 2026', description: 'Add-on: analytics', amount: '$9.00', status: 'pending' },
  { id: 'TXN-004', date: 'Feb 12, 2026', description: 'Pro plan subscription', amount: '$49.00', status: 'completed' },
  { id: 'TXN-005', date: 'Feb 10, 2026', description: 'Refund — duplicate charge', amount: '-$49.00', status: 'completed' },
  { id: 'TXN-006', date: 'Feb 8, 2026', description: 'Enterprise seat upgrade', amount: '$199.00', status: 'failed' },
]

const statusColors: Record<Transaction['status'], string> = {
  completed: 'text-green-600 dark:text-green-400',
  pending: 'text-yellow-600 dark:text-yellow-400',
  failed: 'text-red-500 dark:text-red-400',
}

const columns: DataTableColumnDef<Transaction>[] = [
  {
    accessorKey: 'id',
    header: ({ column }) => <DataTableColumnHeader column={column} title="ID" />,
    cell: ({ row }) => (
      <code className="dark:text-polar-400 font-mono text-xs text-neutral-500">
        {row.getValue('id')}
      </code>
    ),
    size: 120,
  },
  {
    accessorKey: 'date',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
    size: 160,
  },
  {
    accessorKey: 'description',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Description" />,
  },
  {
    accessorKey: 'amount',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" />,
    cell: ({ row }) => (
      <span className="font-medium tabular-nums">{row.getValue('amount')}</span>
    ),
    size: 120,
  },
  {
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => {
      const status: Transaction['status'] = row.getValue('status')
      return (
        <span className={`text-xs font-medium capitalize ${statusColors[status]}`}>
          {status}
        </span>
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
    items: [
      { id: '', customer: 'Pro plan × 1', total: '$49.00' },
    ],
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
    header: ({ column }) => <DataTableColumnHeader column={column} title="Order" />,
    cell: ({ row }) => (
      <div
        className="flex items-center gap-2"
        style={{ paddingLeft: `${row.depth * 20}px` }}
      >
        {row.getCanExpand() ? (
          <span className="dark:text-polar-400 text-neutral-400">
            {row.getIsExpanded() ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </span>
        ) : (
          <span className="w-3.5" />
        )}
        <code className="dark:text-polar-400 font-mono text-xs text-neutral-500">
          {row.getValue('id') || '—'}
        </code>
      </div>
    ),
    size: 140,
  },
  {
    accessorKey: 'customer',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Customer / Item" />,
  },
  {
    accessorKey: 'total',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Total" />,
    cell: ({ row }) => (
      <span className="font-medium tabular-nums">{row.getValue('total')}</span>
    ),
    size: 120,
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DataTablePage() {
  return (
    <div className="flex flex-col gap-20">
      <OrbitPageHeader
        label="Component"
        title="DataTable"
        description={<>A data grid built on{' '}<code className="font-mono text-sm">@tanstack/react-table</code>. Supports sortable columns, row selection, click handlers, pagination, expandable sub-rows, and loading states. Column definitions follow the standard TanStack <code className="font-mono text-sm">ColumnDef</code> API.</>}
      />

      {/* Basic */}
      <div className="flex flex-col gap-8">
        <OrbitSectionHeader title="Basic" />
        <DataTable columns={columns} data={data} isLoading={false} />
      </div>

      {/* Expandable rows */}
      <div className="flex flex-col gap-8">
        <OrbitSectionHeader
          title="Expandable rows"
          description={<>Pass <code className="font-mono text-xs">getSubRows</code> to enable tree expansion. Toggle state lives in the row — use{' '}<code className="font-mono text-xs">row.getToggleExpandedHandler()</code>{' '}and <code className="font-mono text-xs">row.depth</code> to indent.</>}
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
      </div>

      {/* Loading */}
      <div className="flex flex-col gap-8">
        <OrbitSectionHeader title="Loading state" />
        <DataTable columns={columns} data={[]} isLoading={true} />
      </div>

      {/* Empty */}
      <div className="flex flex-col gap-8">
        <OrbitSectionHeader title="Empty state" />
        <DataTable columns={columns} data={[]} isLoading={false} />
      </div>

      {/* API */}
      <div className="flex flex-col gap-8">
        <OrbitSectionHeader title="API" />
        <div className="dark:divide-polar-800 flex flex-col divide-y divide-neutral-200">
          {[
            { name: 'columns', type: 'ColumnDef<TData, TValue>[]', desc: 'Column definitions. Use DataTableColumnDef<T> for convenience.' },
            { name: 'data', type: 'TData[]', desc: 'Row data array.' },
            { name: 'isLoading', type: 'boolean | ReactQueryLoading', desc: 'Shows a loading row. Accepts a TanStack Query result object directly.' },
            { name: 'getSubRows', type: '(row: TData) => TData[]', desc: 'Returns child rows. Enables tree expansion when provided.' },
            { name: 'pagination', type: 'PaginationState', desc: 'Controlled pagination state. Renders pagination controls when provided.' },
            { name: 'onPaginationChange', type: 'OnChangeFn<PaginationState>', desc: 'Called when page index or page size changes.' },
            { name: 'sorting', type: 'SortingState', desc: 'Controlled sort state.' },
            { name: 'onSortingChange', type: 'OnChangeFn<SortingState>', desc: 'Called when column sort changes.' },
            { name: 'onRowClick', type: '(row: Row<TData>) => void', desc: 'Makes rows clickable. Adds cursor-pointer.' },
            { name: 'enableRowSelection', type: 'boolean', desc: 'Enables row selection via checkbox or click.' },
          ].map(({ name, type, desc }) => (
            <div key={name} className="grid grid-cols-5 gap-4 py-4">
              <code className="dark:text-polar-200 font-mono text-sm text-neutral-800">
                {name}
              </code>
              <code className="dark:text-polar-400 col-span-2 font-mono text-xs text-neutral-500">
                {type}
              </code>
              <span className="dark:text-polar-400 col-span-2 text-xs text-neutral-500">
                {desc}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
