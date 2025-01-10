import { Meter } from '@/app/api/meter/[slug]/data'
import { DataTableSortingState } from '@/utils/datatable'
import {
  OnChangeFn,
  PaginationState,
  RowSelectionState,
  SortingState,
} from '@tanstack/react-table'
import { FormattedDateTime } from 'polarkit/components/ui/atoms'
import {
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
} from 'polarkit/components/ui/atoms/datatable'
import { Status } from 'polarkit/components/ui/atoms/Status'
import { twMerge } from 'tailwind-merge'

export interface MetersListProps {
  meters: Meter[]
  pageCount: number
  pagination: PaginationState
  setPagination: OnChangeFn<PaginationState>
  setSorting: OnChangeFn<SortingState>
  sorting: DataTableSortingState
  isLoading: boolean
  selectedMeterState: RowSelectionState
  setSelectedMeterState: OnChangeFn<RowSelectionState>
}

export const MetersList = ({
  meters,
  pageCount,
  pagination,
  setPagination,
  setSorting,
  sorting,
  isLoading,
  selectedMeterState,
  setSelectedMeterState,
}: MetersListProps) => {
  const columns: DataTableColumnDef<Meter>[] = [
    {
      id: 'name',
      accessorKey: 'name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
      cell: ({ row: { original: meter } }) => {
        return <span>{meter.name}</span>
      },
    },
    {
      id: 'slug',
      accessorKey: 'slug',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Slug" />
      ),
      cell: ({ row: { original: meter } }) => {
        return <span className="font-mono text-xs lowercase">{meter.slug}</span>
      },
    },
    {
      id: 'aggregation_type',
      accessorKey: 'aggregation_type',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Aggregation Type" />
      ),
      cell: ({ row: { original: meter } }) => {
        return (
          <Status
            className="dark:bg-polar-700 dark:text-polar-300 w-fit bg-gray-200 capitalize text-gray-500"
            status={meter.aggregation_type}
          />
        )
      },
    },
    {
      id: 'value',
      accessorKey: 'value',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Value" />
      ),
      cell: ({ row: { original: meter } }) => {
        return (
          <span className="font-mono text-sm lowercase">
            {new Intl.NumberFormat('en-US', {
              notation: 'compact',
              compactDisplay: 'short',
            }).format(meter.value)}
          </span>
        )
      },
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row: { original: meter } }) => {
        return (
          <Status
            className={twMerge(
              'w-fit capitalize',
              meter.status === 'active'
                ? 'bg-emerald-100 text-emerald-500 dark:bg-emerald-950'
                : 'bg-red-100 text-red-500 dark:bg-red-950',
            )}
            status={meter.status}
          />
        )
      },
    },
    {
      id: 'created_at',
      accessorKey: 'created_at',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Created At" />
      ),
      cell: ({ row: { original: meter } }) => {
        return (
          <FormattedDateTime dateStyle="long" datetime={meter.created_at} />
        )
      },
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={meters}
      pageCount={pageCount}
      pagination={pagination}
      onPaginationChange={setPagination}
      sorting={sorting}
      onSortingChange={setSorting}
      isLoading={isLoading}
      onRowSelectionChange={(state) => {
        setSelectedMeterState(state)
      }}
      rowSelection={selectedMeterState}
      getRowId={(row) => row.id}
      enableRowSelection
    />
  )
}
