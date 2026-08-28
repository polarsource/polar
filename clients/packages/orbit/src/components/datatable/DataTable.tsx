'use client'

import {
  OnChangeFn,
  PaginationState,
  RowData,
  SortingState,
  flexRender,
  useTable,
} from '@tanstack/react-table'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import { DataTablePagination } from './DataTablePagination'
import {
  createSelectionColumn,
  DataTableSelection,
  SELECTION_COLUMN_ID,
  SELECTION_COLUMN_WIDTH,
} from './DataTableSelectionColumn'
import {
  dataTableFeatures,
  DataTableCell,
  DataTableColumnDef,
  DataTableRow,
} from './features'

export interface ReactQueryLoading {
  isFetching: boolean
  isFetched: boolean
  isLoading: boolean
  status: string
  fetchStatus: string
}

interface DataTableProps<TData extends RowData> {
  columns: DataTableColumnDef<TData>[]
  data: TData[]
  rowCount?: number
  pageCount?: number
  pagination?: PaginationState
  onPaginationChange?: OnChangeFn<PaginationState>
  sorting?: SortingState
  onSortingChange?: OnChangeFn<SortingState>
  getSubRows?: (row: TData) => TData[] | undefined
  className?: string
  wrapperClassName?: string
  headerClassName?: string
  isLoading: boolean | ReactQueryLoading
  getCellColSpan?: (cell: DataTableCell<TData, unknown>) => number
  getRowId?: (
    originalRow: TData,
    index: number,
    parent?: DataTableRow<TData>,
  ) => string
  selection?: DataTableSelection<TData>
  onRowClick?: (row: DataTableRow<TData>) => void
  isRowActive?: (row: DataTableRow<TData>) => boolean
}

export type DataTablePaginationState = PaginationState
export type DataTableSortingState = SortingState

const queryIsDisabled = (s: ReactQueryLoading): boolean => {
  if (s.status === 'pending' && s.fetchStatus === 'idle') {
    return true
  }
  return false
}

export function DataTable<TData extends RowData>({
  columns,
  data,
  rowCount,
  pageCount,
  pagination,
  onPaginationChange,
  sorting,
  onSortingChange,
  getSubRows,
  className,
  wrapperClassName,
  headerClassName,
  isLoading,
  getCellColSpan,
  getRowId,
  selection,
  onRowClick,
  isRowActive,
}: DataTableProps<TData>) {
  const allColumns = React.useMemo(
    () =>
      selection ? [createSelectionColumn(selection), ...columns] : columns,
    [selection, columns],
  )

  const table = useTable({
    features: dataTableFeatures,
    data,
    columns: allColumns,
    manualPagination: true,
    manualSorting: true,
    rowCount,
    pageCount,
    onPaginationChange,
    onSortingChange,
    getSubRows,
    getRowId,
    state: {
      pagination,
      sorting,
    },
  })

  const calcLoading =
    typeof isLoading === 'boolean'
      ? isLoading
      : (!isLoading.isFetched || isLoading.isLoading) &&
        !queryIsDisabled(isLoading)

  return (
    <div className={twMerge('flex flex-col gap-6', className)}>
      <div
        className={twMerge(
          'dark:border-polar-700 overflow-hidden rounded-2xl border border-gray-200',
          wrapperClassName,
        )}
      >
        <Table className="table-fixed">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className={twMerge(
                  'dark:bg-polar-800 group/row bg-gray-50',
                  headerClassName,
                )}
              >
                {headerGroup.headers.map((header) => {
                  const isSelectColumn =
                    header.column.id === SELECTION_COLUMN_ID

                  return (
                    <TableHead
                      key={header.id}
                      className={isSelectColumn ? 'w-12' : undefined}
                      style={
                        isSelectColumn
                          ? { width: SELECTION_COLUMN_WIDTH }
                          : { width: header.column.getSize() }
                      }
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {calcLoading ? (
              <TableRow>
                <TableCell
                  colSpan={allColumns.length}
                  className="h-24 text-center"
                >
                  Loading...
                </TableCell>
              </TableRow>
            ) : (
              <>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className={twMerge(
                        'group/row',
                        onRowClick && 'cursor-pointer',
                      )}
                      data-state={
                        isRowActive?.(row) ||
                        selection?.isSelected(row.original)
                          ? 'selected'
                          : undefined
                      }
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                    >
                      {row.getVisibleCells().map((cell) => {
                        const colSpan = getCellColSpan
                          ? getCellColSpan(cell)
                          : 1
                        const isSelectColumn =
                          cell.column.id === SELECTION_COLUMN_ID

                        return (
                          <React.Fragment key={cell.id}>
                            {colSpan ? (
                              <TableCell
                                colSpan={colSpan}
                                className={isSelectColumn ? 'w-12' : undefined}
                                style={
                                  isSelectColumn
                                    ? { width: SELECTION_COLUMN_WIDTH }
                                    : { width: cell.column.getSize() }
                                }
                              >
                                {flexRender(
                                  cell.column.columnDef.cell,
                                  cell.getContext(),
                                )}
                              </TableCell>
                            ) : null}
                          </React.Fragment>
                        )
                      })}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={allColumns.length}
                      className="h-24 text-center"
                    >
                      No Results
                    </TableCell>
                  </TableRow>
                )}
              </>
            )}
          </TableBody>
        </Table>
      </div>
      {pagination ? <DataTablePagination table={table} /> : null}
    </div>
  )
}
