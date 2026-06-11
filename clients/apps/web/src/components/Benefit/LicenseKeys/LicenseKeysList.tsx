import { DataTableSortingState } from '@/utils/datatable'
import { schemas } from '@polar-sh/client'
import { Avatar } from '@polar-sh/orbit'
import {
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
} from '@polar-sh/orbit'
import { Status } from '@polar-sh/orbit'
import {
  OnChangeFn,
  PaginationState,
  RowSelectionState,
  SortingState,
} from '@tanstack/react-table'

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
              name={
                licenseKey.customer.email ?? licenseKey.customer.name ?? '—'
              }
            />
            <div className="flex flex-col">
              <span className="text-sm">{licenseKey.customer.name}</span>
              <span className="dark:text-polar-500 text-xs text-gray-500">
                {licenseKey.customer.email ?? '—'}
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
      enableSorting: false,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row: { original: licenseKey } }) => {
        return (
          <Status
            color={licenseKey.status === 'granted' ? 'green' : 'red'}
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
