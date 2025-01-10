'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import ProductSelect from '@/components/Products/ProductSelect'
import { useOrders } from '@/hooks/queries/orders'
import {
  DataTablePaginationState,
  DataTableSortingState,
  getAPIParams,
  serializeSearchParams,
} from '@/utils/datatable'
import { Order, OrderCustomer, Organization, Product } from '@polar-sh/sdk'
import { RowSelectionState } from '@tanstack/react-table'
import { useRouter } from 'next/navigation'
import { FormattedDateTime, Pill } from 'polarkit/components/ui/atoms'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import {
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
} from 'polarkit/components/ui/atoms/datatable'
import { formatCurrencyAndAmount } from 'polarkit/lib/money'
import React, { useEffect, useState } from 'react'

const AmountColumn = ({ order }: { order: Order }) => {
  return (
    <div className="flex flex-row gap-x-2">
      <span>{formatCurrencyAndAmount(order.amount, order.currency)}</span>
      {order.status == 'refunded' && (
        <Pill color="red" className="flex flex-row">
          <span>Refunded</span>
        </Pill>
      )}
      {order.status == 'partially_refunded' && (
        <Pill color="gray" className="flex flex-row">
          <span>Partial Refund</span>
        </Pill>
      )}
    </div>
  )
}

interface ClientPageProps {
  organization: Organization
  pagination: DataTablePaginationState
  sorting: DataTableSortingState
  productId?: string[]
}

const ClientPage: React.FC<ClientPageProps> = ({
  organization,
  pagination,
  sorting,
  productId,
}) => {
  const [selectedOrderState, setSelectedOrderState] =
    useState<RowSelectionState>({})

  const getSearchParams = (
    pagination: DataTablePaginationState,
    sorting: DataTableSortingState,
    productId?: string[],
  ) => {
    const params = serializeSearchParams(pagination, sorting)

    if (productId) {
      productId.forEach((id) => params.append('product_id', id))
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
      `/dashboard/${organization.slug}/sales?${getSearchParams(
        updatedPagination,
        sorting,
        productId,
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
      `/dashboard/${organization.slug}/sales?${getSearchParams(
        pagination,
        updatedSorting,
        productId,
      )}`,
    )
  }

  const onProductSelect = (value: string[]) => {
    router.push(
      `/dashboard/${organization.slug}/sales?${getSearchParams(
        pagination,
        sorting,
        value,
      )}`,
    )
  }

  const ordersHook = useOrders(organization.id, {
    ...getAPIParams(pagination, sorting),
    productId,
  })

  const orders = ordersHook.data?.items || []
  const pageCount = ordersHook.data?.pagination.max_page ?? 1

  const columns: DataTableColumnDef<Order>[] = [
    {
      accessorKey: 'customer',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Customer" />
      ),
      cell: (props) => {
        const customer = props.getValue() as OrderCustomer
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
      accessorKey: 'amount',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Amount" />
      ),
      cell: ({ row: { original: order } }) => <AmountColumn order={order} />,
    },
    {
      accessorKey: 'product',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Product" />
      ),
      cell: (props) => {
        const product = props.getValue() as Product
        return (
          <>
            {product.name}
            {product.is_archived && (
              <span className="ml-2 shrink-0 rounded-lg border border-yellow-200 bg-yellow-100 px-1.5 text-xs text-yellow-600 dark:border-yellow-600 dark:bg-yellow-700 dark:text-yellow-300">
                Archived
              </span>
            )}
          </>
        )
      },
    },
    {
      accessorKey: 'created_at',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Date" />
      ),
      cell: (props) => (
        <FormattedDateTime datetime={props.getValue() as string} />
      ),
    },
  ]

  const selectedOrder = orders.find((order) => selectedOrderState[order.id])

  useEffect(() => {
    if (selectedOrder) {
      router.push(`/dashboard/${organization.slug}/sales/${selectedOrder.id}`)
    }
  }, [selectedOrder, router])

  return (
    <DashboardBody>
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between gap-2">
          <div className="w-auto">
            <ProductSelect
              organization={organization}
              value={productId || []}
              onChange={onProductSelect}
              className="w-[300px]"
            />
          </div>
        </div>
        {orders && pageCount !== undefined && (
          <DataTable
            columns={columns}
            data={orders}
            pageCount={pageCount}
            pagination={pagination}
            onPaginationChange={setPagination}
            sorting={sorting}
            onSortingChange={setSorting}
            isLoading={ordersHook.isLoading}
            onRowSelectionChange={(row) => {
              setSelectedOrderState(row)
            }}
            rowSelection={selectedOrderState}
            getRowId={(row) => row.id.toString()}
            enableRowSelection
          />
        )}
      </div>
    </DashboardBody>
  )
}

export default ClientPage
