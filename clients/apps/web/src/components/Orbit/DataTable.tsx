'use client'

import {
  Cell,
  ColumnDef,
  OnChangeFn,
  PaginationState,
  Row,
  RowSelectionState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoveDown,
  MoveUp,
} from 'lucide-react'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import { Button } from './Button'

// ─── Table primitives ────────────────────────────────────────────────────────

function Table({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="relative w-full overflow-auto">
      <table
        className={twMerge('w-full caption-bottom text-sm', className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={twMerge(className)} {...props} />
}

function TableBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      className={twMerge('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  )
}

function TableRow({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={twMerge(
        'dark:border-polar-800 dark:hover:bg-polar-900 dark:data-[state=selected]:bg-polar-800 border-b border-neutral-100 transition-colors hover:bg-neutral-50 data-[state=selected]:bg-neutral-100',
        className,
      )}
      {...props}
    />
  )
}

function TableHead({
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={twMerge(
        'dark:text-polar-500 h-10 px-4 text-left align-middle text-xs font-medium tracking-tight text-neutral-500',
        className,
      )}
      {...props}
    />
  )
}

function TableCell({
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={twMerge('px-4 py-3 align-middle text-sm', className)}
      {...props}
    />
  )
}

// ─── Column header ────────────────────────────────────────────────────────────

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: {
  column: import('@tanstack/react-table').Column<TData, TValue>
  title: string
  className?: string
}) {
  if (!column.getCanSort()) {
    return <div className={className}>{title}</div>
  }

  return (
    <button
      type="button"
      className={twMerge(
        'dark:text-polar-500 flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-xs font-medium tracking-tight text-neutral-500 transition-opacity duration-150 hover:opacity-70',
        className,
      )}
      onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
    >
      {title}
      {column.getIsSorted() === 'desc' ? (
        <MoveDown className="h-3 w-3" />
      ) : column.getIsSorted() === 'asc' ? (
        <MoveUp className="h-3 w-3" />
      ) : null}
    </button>
  )
}

// ─── Pagination ───────────────────────────────────────────────────────────────

const SUPPORTED_PAGE_SIZES = [20, 50, 100]

function DataTablePagination<TData>({
  table,
}: {
  table: import('@tanstack/react-table').Table<TData>
}) {
  const { pageIndex, pageSize } = table.getState().pagination
  const startItem = pageIndex * pageSize + 1
  const endItem = Math.min(startItem + pageSize - 1, table.getRowCount())
  const rowCount = table.getRowCount()

  if (rowCount === 0 || endItem === 0) return null

  const isShowingAll = startItem === 1 && endItem === rowCount

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 sm:flex-nowrap sm:justify-end sm:px-2">
      <div className="order-3 flex w-full flex-none items-center justify-between gap-2 sm:order-none sm:w-auto sm:justify-start">
        <span className="dark:text-polar-500 text-sm text-neutral-500">
          Rows per page
        </span>
        <select
          value={pageSize}
          onChange={(e) => table.setPageSize(Number(e.target.value))}
          className="dark:bg-polar-800 dark:text-polar-200 h-8 rounded-md border-0 bg-neutral-100 px-2 text-sm text-black outline-none"
        >
          {SUPPORTED_PAGE_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="dark:text-polar-500 flex flex-1 items-center justify-start text-sm text-neutral-500 sm:w-40 sm:flex-none sm:justify-center">
        {rowCount === 1
          ? 'Viewing the only record'
          : isShowingAll
            ? `Viewing all ${rowCount} records`
            : `Viewing ${startItem}–${endItem} of ${rowCount}`}
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="secondary"
          size="icon"
          onClick={() => table.setPageIndex(0)}
          disabled={!table.getCanPreviousPage()}
          className="hidden lg:flex"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          onClick={() => table.setPageIndex(table.getPageCount() - 1)}
          disabled={!table.getCanNextPage()}
          className="hidden lg:flex"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReactQueryLoading {
  isFetching: boolean
  isFetched: boolean
  isLoading: boolean
  status: string
  fetchStatus: string
}

export type DataTableColumnDef<TData, TValue = unknown> = ColumnDef<
  TData,
  TValue
>
export type DataTablePaginationState = PaginationState
export type DataTableSortingState = SortingState

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
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
  getCellColSpan?: (cell: Cell<TData, unknown>) => number
  getRowId?: (originalRow: TData, index: number, parent?: Row<TData>) => string
  rowSelection?: RowSelectionState
  enableRowSelection?: boolean
  onRowSelectionChange?: OnChangeFn<RowSelectionState>
  onRowClick?: (row: Row<TData>) => void
}

// ─── Main component ───────────────────────────────────────────────────────────

const queryIsDisabled = (s: ReactQueryLoading) =>
  s.status === 'pending' && s.fetchStatus === 'idle'

export function DataTable<TData, TValue>({
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
  rowSelection,
  enableRowSelection,
  onRowSelectionChange,
  onRowClick,
}: DataTableProps<TData, TValue>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    rowCount,
    pageCount,
    onPaginationChange,
    onSortingChange,
    getSubRows,
    getExpandedRowModel: getExpandedRowModel(),
    getRowId,
    enableRowSelection,
    onRowSelectionChange,
    enableMultiRowSelection: false,
    state: { pagination, sorting, rowSelection },
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
          'dark:border-polar-800 overflow-hidden rounded-xl border border-neutral-200',
          wrapperClassName,
        )}
      >
        <Table className="table-fixed">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className={twMerge(
                  'dark:bg-polar-900 bg-neutral-50',
                  headerClassName,
                )}
              >
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{ width: header.column.getSize() }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {calcLoading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  Loading…
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={
                    enableRowSelection || onRowClick
                      ? row.getCanSelect()
                        ? 'cursor-pointer'
                        : ''
                      : undefined
                  }
                  data-state={
                    enableRowSelection
                      ? row.getIsSelected()
                        ? 'selected'
                        : undefined
                      : undefined
                  }
                  onClick={
                    onRowClick
                      ? () => onRowClick(row)
                      : enableRowSelection
                        ? row.getToggleSelectedHandler()
                        : undefined
                  }
                >
                  {row.getVisibleCells().map((cell) => {
                    const colSpan = getCellColSpan ? getCellColSpan(cell) : 1
                    return (
                      <React.Fragment key={cell.id}>
                        {colSpan ? (
                          <TableCell
                            colSpan={colSpan}
                            style={{ width: cell.column.getSize() }}
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
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {pagination && <DataTablePagination table={table} />}
    </div>
  )
}
