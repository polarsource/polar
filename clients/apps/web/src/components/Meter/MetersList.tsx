import { DataTableSortingState } from '@/utils/datatable'
import { schemas } from '@polar-sh/client'
import {
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
} from '@polar-sh/ui/components/atoms/DataTable'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import {
  OnChangeFn,
  PaginationState,
  RowSelectionState,
  SortingState,
} from '@tanstack/react-table'

export interface MetersListProps {
  meters: schemas['Meter'][]
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
  const columns: DataTableColumnDef<schemas['Meter']>[] = [
    {
      id: 'name',
      accessorKey: 'name',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
      cell: ({ row: { original: meter } }) => {
        return <span>{meter.name}</span>
      },
    },
    {
      id: 'aggregation_function',
      accessorKey: 'aggregation.func',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Aggregation Type" />
      ),
      cell: ({ row: { original: meter } }) => {
        return (
          <Status
            className="dark:bg-polar-700 dark:text-polar-300 w-fit bg-gray-200 text-gray-500 capitalize"
            status={meter.aggregation.func}
          />
        )
      },
    },
    {
      id: 'created_at',
      accessorKey: 'created_at',
      enableSorting: true,
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
