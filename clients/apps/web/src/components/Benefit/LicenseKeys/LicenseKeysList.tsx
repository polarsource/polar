import { DataTableSortingState } from '@/utils/datatable'
import { schemas } from '@polar-sh/client'
import { Avatar, Truncated } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
} from '@polar-sh/orbit'
import { Status } from '@polar-sh/orbit'
import {
  OnChangeFn,
  PaginationState,
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
  selectedLicenseKeyId: string | null
  onSelectLicenseKey: (licenseKey: schemas['LicenseKeyRead']) => void
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
  selectedLicenseKeyId,
  onSelectLicenseKey,
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
          <Box alignItems="center" columnGap="m" minWidth={0}>
            <Avatar
              className="h-10 w-10"
              avatar_url={licenseKey.customer.avatar_url}
              name={
                licenseKey.customer.email ?? licenseKey.customer.name ?? '—'
              }
            />
            <Box flexDirection="column" minWidth={0}>
              <Truncated>
                <span className="text-sm">{licenseKey.customer.name}</span>
              </Truncated>
              <Truncated>
                <span className="dark:text-polar-500 text-xs text-gray-500">
                  {licenseKey.customer.email ?? '—'}
                </span>
              </Truncated>
            </Box>
          </Box>
        )
      },
    },
    {
      id: 'license_key',
      enableSorting: false,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="License key" />
      ),
      cell: ({ row: { original: licenseKey } }) => {
        return (
          <Truncated>
            <span className="font-mono text-xs">{licenseKey.display_key}</span>
          </Truncated>
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
      onRowClick={(row) => onSelectLicenseKey(row.original)}
      isRowActive={(row) => row.original.id === selectedLicenseKeyId}
      getRowId={(row) => row.id}
    />
  )
}
