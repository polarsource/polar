import { Table } from '@tanstack/react-table'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'
import Button from '../Button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../Select'

interface DataTablePaginationProps<TData> {
  table: Table<TData>
}

const SUPPORTED_PAGE_SIZES = [20, 50, 100]
const DEFAULT_PAGE_SIZE = SUPPORTED_PAGE_SIZES[0]

export function DataTablePagination<TData>({
  table,
}: DataTablePaginationProps<TData>) {
  const { pageIndex, pageSize } = table.getState().pagination
  const startItem = pageIndex * pageSize + 1
  const endItem = Math.min(startItem + pageSize - 1, table.getRowCount())

  const rowCount = table.getRowCount()

  if (endItem === 0) {
    return <></>
  }

  if (rowCount === 0) {
    return <></>
  }

  const isShowingAllRecords = startItem === 1 && endItem === rowCount

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 sm:flex-nowrap sm:justify-end sm:px-2 lg:gap-x-8">
      <div className="order-3 flex w-full flex-none items-center justify-between gap-2 sm:order-0 sm:w-auto sm:justify-start">
        <p className="dark:text-polar-500 text-sm text-gray-700">
          Rows per page
        </p>
        <Select
          value={`${table.getState().pagination.pageSize}`}
          onValueChange={(value) => {
            table.setPageSize(Number(value))
          }}
        >
          <SelectTrigger className="h-8 w-[75px]">
            <SelectValue placeholder={table.getState().pagination.pageSize} />
          </SelectTrigger>
          <SelectContent side="top">
            {SUPPORTED_PAGE_SIZES.map((pageSize) => (
              <SelectItem key={pageSize} value={`${pageSize}`}>
                {pageSize}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="dark:text-polar-500 flex flex-1 items-center justify-start text-sm text-gray-700 sm:w-[160px] sm:flex-none sm:justify-center">
        {rowCount === 1
          ? 'Viewing the only record'
          : isShowingAllRecords
            ? `Viewing all ${rowCount} records`
            : `Viewing ${startItem}-${endItem} of ${rowCount}`}
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          className="hidden h-8 w-8 p-0 lg:flex"
          onClick={() => table.setPageIndex(0)}
          disabled={!table.getCanPreviousPage()}
        >
          <span className="sr-only">Go to first page</span>
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          className="h-8 w-8 p-0"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          <span className="sr-only">Go to previous page</span>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          className="h-8 w-8 p-0"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          <span className="sr-only">Go to next page</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          className="hidden h-8 w-8 p-0 lg:flex"
          onClick={() => table.setPageIndex(table.getPageCount() - 1)}
          disabled={!table.getCanNextPage()}
        >
          <span className="sr-only">Go to last page</span>
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
