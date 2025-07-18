import { DataTableSortingState } from '@/utils/datatable'
import { schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import {
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
} from '@polar-sh/ui/components/atoms/DataTable'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import {
  OnChangeFn,
  PaginationState,
  RowSelectionState,
  SortingState,
} from '@tanstack/react-table'
import { twMerge } from 'tailwind-merge'

export interface LicenseKeysListProps {
  licenseKeys: schemas['LicenseKeyRead'][]
  rowCount: number
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
  rowCount,
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
        return (
          <Status
            className={twMerge(
              'w-fit',
              licenseKey.status === 'granted'
                ? 'bg-emerald-200 text-emerald-500 dark:bg-emerald-950'
                : 'bg-red-100 text-red-500 dark:bg-red-950',
            )}
            status={licenseKey.status === 'granted' ? 'Granted' : 'Revoked'}
          />
        )
      },
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={licenseKeys}
      rowCount={rowCount}
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
