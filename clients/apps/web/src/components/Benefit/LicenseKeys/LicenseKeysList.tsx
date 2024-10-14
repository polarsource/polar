import { DataTableSortingState } from '@/utils/datatable'
import { LicenseKeyRead } from '@polar-sh/sdk'
import {
  OnChangeFn,
  PaginationState,
  SortingState,
} from '@tanstack/react-table'
import { FormattedDateTime } from 'polarkit/components/ui/atoms'
import Avatar from 'polarkit/components/ui/atoms/avatar'
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
    {
      accessorKey: 'user',
      sortingFn: (a, b) => {
        return a.original.user.public_name.localeCompare(
          b.original.user.public_name,
        )
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="User" />
      ),
      cell: ({ row: { original: licenseKey } }) => {
        return (
          <div className="flex flex-row items-center gap-x-3">
            <Avatar
              className="h-10 w-10"
              avatar_url={licenseKey.user.avatar_url}
              name={licenseKey.user.public_name}
            />
            <div className="flex flex-col">
              <span className="text-sm">{licenseKey.user.public_name}</span>
              <span className="dark:text-polar-500 text-xs text-gray-500">
                {licenseKey.user.email}
              </span>
            </div>
          </div>
        )
      },
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
