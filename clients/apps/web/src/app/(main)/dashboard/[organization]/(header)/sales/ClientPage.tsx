'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { MiniMetricChartBox } from '@/components/Metrics/MiniMetricChartBox'
import ProductSelect from '@/components/Products/ProductSelect'
import { OrderAmountWithRefund } from '@/components/Refunds/OrderAmountWithRefund'
import { useMetrics } from '@/hooks/queries/metrics'
import { useOrders } from '@/hooks/queries/orders'
import {
  DataTablePaginationState,
  DataTableSortingState,
  getAPIParams,
  serializeSearchParams,
} from '@/utils/datatable'
import { dateToInterval } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import {
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
} from '@polar-sh/ui/components/atoms/DataTable'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { RowSelectionState } from '@tanstack/react-table'
import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'

interface ClientPageProps {
  organization: schemas['Organization']
  pagination: DataTablePaginationState
  sorting: DataTableSortingState
  productId?: string[]
  metadata?: string[]
}

const ClientPage: React.FC<ClientPageProps> = ({
  organization,
  pagination,
  sorting,
  productId,
  metadata,
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

    if (metadata) {
      metadata.forEach((key) => params.append('metadata', key))
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
    product_id: productId,
  })

  const orders = ordersHook.data?.items || []
  const pageCount = ordersHook.data?.pagination.max_page ?? 1

  const columns: DataTableColumnDef<schemas['Order']>[] = [
    {
      accessorKey: 'customer',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Customer" />
      ),
      cell: (props) => {
        const customer = props.getValue() as schemas['OrderCustomer']
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
      cell: ({ row: { original: order } }) => (
        <OrderAmountWithRefund order={order} />
      ),
    },
    {
      accessorKey: 'product',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Product" />
      ),
      cell: (props) => {
        const product = props.getValue() as schemas['Product']
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
    ...(metadata
      ? metadata.map<DataTableColumnDef<schemas['Order']>>((key) => ({
          accessorKey: `metadata.${key}`,
          enableSorting: false,
          header: ({ column }) => (
            <DataTableColumnHeader column={column} title={key} />
          ),
          cell: (props) => (
            <span className="font-mono">{props.getValue() as string}</span>
          ),
        }))
      : []),
  ]

  const selectedOrder = orders.find((order) => selectedOrderState[order.id])

  useEffect(() => {
    if (selectedOrder) {
      router.push(`/dashboard/${organization.slug}/sales/${selectedOrder.id}`)
    }
  }, [selectedOrder, router, organization])

  const { data: metricsData } = useMetrics({
    organization_id: organization.id,
    startDate: new Date(organization.created_at),
    endDate: new Date(),
    interval: dateToInterval(new Date(organization.created_at)),
    product_id: productId,
  })
  const { data: todayMetricsData } = useMetrics({
    organization_id: organization.id,
    startDate: new Date(),
    endDate: new Date(),
    interval: 'day',
    product_id: productId,
  })

  return (
    <DashboardBody wide>
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
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <MiniMetricChartBox
            value={metricsData?.periods.reduce(
              (acc, current) => acc + current.orders,
              0,
            )}
            metric={metricsData?.metrics.orders}
          />
          <MiniMetricChartBox
            title="Today's Revenue"
            value={
              todayMetricsData?.periods[todayMetricsData.periods.length - 1]
                .revenue
            }
            metric={todayMetricsData?.metrics.revenue}
          />
          <MiniMetricChartBox
            value={
              metricsData?.periods[metricsData.periods.length - 1]
                .cumulative_revenue
            }
            metric={metricsData?.metrics.cumulative_revenue}
          />
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
