import { DataTableSortingState } from '@/utils/datatable'
import { schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import {
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
} from '@polar-sh/ui/components/atoms/DataTable'
import {
  OnChangeFn,
  PaginationState,
  RowSelectionState,
  SortingState,
} from '@tanstack/react-table'

export interface LicenseKeysListProps {
  licenseKeys: schemas['LicenseKeyRead'][]
  pageCount: number
  pagination: PaginationState
  setPagination: OnChangeFn<PaginationState>
  setSorting: OnChangeFn<SortingState>
  sorting: DataTableSortingState
  isLoading: boolean
  selectedLicenseKey: RowSelectionState
  onSelectLicenseKeyChange?: OnChangeFn<RowSelectionState>
}

export const LicenseKeysList = ({
  licenseKeys,
  pageCount,
  pagination,
  setPagination,
  setSorting,
  sorting,
  isLoading,
  selectedLicenseKey,
  onSelectLicenseKeyChange,
}: LicenseKeysListProps) => {
  const columns: DataTableColumnDef<schemas['LicenseKeyRead']>[] = [
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
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row: { original: licenseKey } }) => {
        return <span className="capitalize">{licenseKey.status}</span>
      },
    },
    {
      id: 'usage',
      accessorKey: 'usage',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Usage" />
      ),
      cell: ({ row: { original: licenseKey } }) => {
        return (
          <div className="flex flex-row gap-x-2">
            {typeof licenseKey.limit_usage === 'number' ? (
              <span>
                {licenseKey.usage}/{licenseKey.limit_usage}
              </span>
            ) : (
              <span>{licenseKey.usage}</span>
            )}
          </div>
        )
      },
    },
    {
      id: 'customer',
      accessorKey: 'customer',
      enableSorting: false,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Customer" />
      ),
      cell: ({ row: { original: licenseKey } }) => {
        return (
          <div className="flex flex-row items-center gap-x-3">
            <Avatar
              className="h-10 w-10"
              avatar_url={licenseKey.customer.avatar_url}
              name={licenseKey.customer.name || licenseKey.customer.email}
            />
            <div className="flex flex-col">
              <span className="text-sm">{licenseKey.customer.name}</span>
              <span className="dark:text-polar-500 text-xs text-gray-500">
                {licenseKey.customer.email}
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
      enableRowSelection={true}
      onRowSelectionChange={onSelectLicenseKeyChange}
      rowSelection={selectedLicenseKey}
      getRowId={(row) => row.id}
    />
  )
}
