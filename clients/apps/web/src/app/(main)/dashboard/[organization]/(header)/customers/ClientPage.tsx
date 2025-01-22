'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useCustomers } from '@/hooks/queries'
import useDebouncedCallback from '@/hooks/utils'
import {
  DataTablePaginationState,
  DataTableSortingState,
  getAPIParams,
  serializeSearchParams,
} from '@/utils/datatable'

import { Search } from '@mui/icons-material'
import { Customer, Organization } from '@polar-sh/api'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import {
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
} from '@polar-sh/ui/components/atoms/DataTable'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import Input from '@polar-sh/ui/components/atoms/Input'
import { RowSelectionState } from '@tanstack/react-table'
import { useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useState } from 'react'

interface ClientPageProps {
  organization: Organization
  pagination: DataTablePaginationState
  sorting: DataTableSortingState
  query: string | undefined
}

const ClientPage: React.FC<ClientPageProps> = ({
  organization,
  pagination,
  sorting,
  query: _query,
}) => {
  const [query, setQuery] = useState(_query)

  const [selectedCustomerState, setSelectedOrderState] =
    useState<RowSelectionState>({})

  const getSearchParams = (
    pagination: DataTablePaginationState,
    sorting: DataTableSortingState,
    query: string | undefined,
  ) => {
    const params = serializeSearchParams(pagination, sorting)

    if (query) {
      params.append('query', query)
    }

    return params
  }

  const router = useRouter()

  const setPagination = (
    updaterOrValue:
      | DataTablePaginationState
      | ((old: DataTablePaginationState) => DataTablePaginationState),
  ) => {
    const updatedPagination =
      typeof updaterOrValue === 'function'
        ? updaterOrValue(pagination)
        : updaterOrValue

    router.push(
      `/dashboard/${organization.slug}/customers?${getSearchParams(
        updatedPagination,
        sorting,
        query,
      )}`,
    )
  }

  const setSorting = (
    updaterOrValue:
      | DataTableSortingState
      | ((old: DataTableSortingState) => DataTableSortingState),
  ) => {
    const updatedSorting =
      typeof updaterOrValue === 'function'
        ? updaterOrValue(sorting)
        : updaterOrValue

    router.push(
      `/dashboard/${organization.slug}/customers?${getSearchParams(
        pagination,
        updatedSorting,
        query,
      )}`,
    )
  }

  const debouncedQueryChange = useDebouncedCallback(
    (query: string) => {
      router.push(
        `/dashboard/${organization.slug}/customers?${getSearchParams(
          { ...pagination, pageIndex: 0 },
          sorting,
          query,
        )}`,
      )
    },
    500,
    [pagination, sorting, query, router],
  )

  const onQueryChange = useCallback(
    (query: string) => {
      setQuery(query)
      debouncedQueryChange(query)
    },
    [debouncedQueryChange],
  )

  const customersHook = useCustomers(organization.id, {
    ...getAPIParams(pagination, sorting),
    query,
  })

  const customers = customersHook.data?.items || []
  const pageCount = customersHook.data?.pagination.max_page ?? 1

  const columns: DataTableColumnDef<Customer>[] = [
    {
      accessorKey: 'email',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Email" />
      ),
      cell: ({ row: { original: customer } }) => {
        return (
          <div className="flex flex-row items-center gap-2">
            <Avatar
              className="h-8 w-8"
              avatar_url={customer.avatar_url}
              name={customer.name || customer.email}
            />
            <div className="fw-medium">{customer.email}</div>
          </div>
        )
      },
    },
    {
      accessorKey: 'name',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
      cell: (props) => {
        const name = props.getValue() as string | null
        return <>{name || '—'}</>
      },
    },
    {
      accessorKey: 'created_at',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Created At" />
      ),
      cell: (props) => (
        <FormattedDateTime datetime={props.getValue() as string} />
      ),
    },
  ]

  const selectedCustomer = customers.find(
    (order) => selectedCustomerState[order.id],
  )

  useEffect(() => {
    if (selectedCustomer) {
      router.push(
        `/dashboard/${organization.slug}/customers/${selectedCustomer.id}`,
      )
    }
  }, [selectedCustomer, router, organization.slug])

  return (
    <DashboardBody>
      <div className="flex flex-col gap-8">
        <div className="flex flex-row items-center justify-between gap-6">
          <Input
            className="w-full max-w-64"
            preSlot={<Search fontSize="small" />}
            placeholder="Search Customers"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
          />
        </div>
        {customers && pageCount !== undefined && (
          <DataTable
            columns={columns}
            data={customers}
            pageCount={pageCount}
            pagination={pagination}
            onPaginationChange={setPagination}
            sorting={sorting}
            onSortingChange={setSorting}
            isLoading={customersHook.isLoading}
            onRowSelectionChange={(row) => {
              setSelectedOrderState(row)
            }}
            rowSelection={selectedCustomerState}
            getRowId={(row) => row.id.toString()}
            enableRowSelection
          />
        )}
      </div>
    </DashboardBody>
  )
}

export default ClientPage
