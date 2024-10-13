import { DataTableSortingState } from '@/utils/datatable'
import { LicenseKeyRead } from '@polar-sh/sdk'
import {
  OnChangeFn,
  PaginationState,
  SortingState,
} from '@tanstack/react-table'
import { FormattedDateTime } from 'polarkit/components/ui/atoms'
import {
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
} from 'polarkit/components/ui/atoms/datatable'

export interface LicenseKeysListProps {
  licenseKeys: LicenseKeyRead[]
  pageCount: number
  pagination: PaginationState
  setPagination: OnChangeFn<PaginationState>
  setSorting: OnChangeFn<SortingState>
  sorting: DataTableSortingState
  isLoading: boolean
}

export const LicenseKeysList = ({
  licenseKeys,
  pageCount,
  pagination,
  setPagination,
  setSorting,
  sorting,
  isLoading,
}: LicenseKeysListProps) => {
  const columns: DataTableColumnDef<LicenseKeyRead>[] = [
    {
      id: 'license_key',
      enableSorting: false,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="License Key" />
      ),
      cell: ({ row: { original: licenseKey } }) => {
        return (
          <span className="font-mono text-xs">{licenseKey.display_key}</span>
        )
      },
    },
    {
      id: 'status',
      accessorKey: 'status',
      enableSorting: false,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row: { original: licenseKey } }) => {
        return (
          <div className="flex flex-row gap-x-2">
            <span className="capitalize">{licenseKey.status}</span>
            {typeof licenseKey.limit_usage === 'number' && (
              <span className="dark:text-polar-500 text-gray-500">
                ({licenseKey.usage}/{licenseKey.limit_usage})
              </span>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'expires_at',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Expiry date" />
      ),
      cell: (props) => (
        <FormattedDateTime datetime={props.getValue() as string} />
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={licenseKeys}
      pageCount={pageCount}
      pagination={pagination}
      onPaginationChange={setPagination}
      sorting={sorting}
      onSortingChange={setSorting}
      isLoading={isLoading}
    />
  )
}
