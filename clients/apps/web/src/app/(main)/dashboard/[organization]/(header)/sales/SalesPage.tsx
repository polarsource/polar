'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { MiniMetricChartBox } from '@/components/Metrics/MiniMetricChartBox'
import { OrderStatus } from '@/components/Orders/OrderStatus'
import ProductSelect from '@/components/Products/ProductSelect'
import { useMetrics } from '@/hooks/queries/metrics'
import { useOrders } from '@/hooks/queries/orders'
import { getServerURL } from '@/utils/api'
import {
  DataTablePaginationState,
  DataTableSortingState,
  getAPIParams,
  serializeSearchParams,
} from '@/utils/datatable'
import { getChartRangeParams } from '@/utils/metrics'
import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined'
import { schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
} from '@polar-sh/ui/components/atoms/DataTable'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
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
  const rowCount = ordersHook.data?.pagination.total_count ?? 0
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
            <div className="fw-medium overflow-hidden text-ellipsis">
              {customer.email}
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: 'net_amount',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Amount" />
      ),
      cell: ({ row: { original: order } }) => (
        <span>{formatCurrencyAndAmount(order.net_amount, order.currency)}</span>
      ),
    },
    {
      accessorKey: 'product',
      enableSorting: false,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Description" />
      ),
      cell: ({
        row: {
          original: { product, description },
        },
      }) => {
        if (!product) {
          return <span>{description}</span>
        }
        return (
          <div className="flex flex-row items-center gap-4">
            {product.name}
            {product.is_archived && (
              <Status
                status="Archived"
                className="bg-red-100 text-xs text-red-500 dark:bg-red-950"
              />
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'status',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row: { original: order } }) => (
        <span className="flex shrink">
          <OrderStatus status={order.status} />
        </span>
      ),
    },
    {
      accessorKey: 'invoice_number',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Invoice number" />
      ),
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

  const [allTimeStart, allTimeEnd, allTimeInterval] = getChartRangeParams(
    'all_time',
    organization.created_at,
  )
  const { data: metricsData } = useMetrics({
    organization_id: organization.id,
    startDate: allTimeStart,
    endDate: allTimeEnd,
    interval: allTimeInterval,
    product_id: productId,
    metrics: ['orders', 'revenue', 'cumulative_revenue'],
  })
  const { data: todayMetricsData } = useMetrics({
    organization_id: organization.id,
    startDate: new Date(),
    endDate: new Date(),
    interval: 'day',
    product_id: productId,
    metrics: ['revenue'],
  })

  const onExport = () => {
    const productIds =
      productId?.map((id) => `&product_id=${id}`).join('') || ''
    const url = new URL(
      `${getServerURL()}/v1/orders/export?organization_id=${organization.id}${productIds}`,
    )

    window.open(url, '_blank')
  }

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
              includeArchived
            />
          </div>
          <Button
            onClick={onExport}
            className="flex flex-row items-center"
            variant={'secondary'}
            wrapperClassNames="gap-x-2"
          >
            <FileDownloadOutlined fontSize="inherit" />
            <span>Export</span>
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <MiniMetricChartBox
            title="Orders"
            value={metricsData?.totals.orders}
            metric={metricsData?.metrics.orders}
          />
          <MiniMetricChartBox
            title="Today's Revenue"
            value={todayMetricsData?.totals.revenue}
            metric={todayMetricsData?.metrics.revenue}
          />
          <MiniMetricChartBox
            title="Cumulative Revenue"
            value={metricsData?.totals.revenue}
            metric={metricsData?.metrics.cumulative_revenue}
          />
        </div>
        {orders && pageCount !== undefined && (
          <DataTable
            columns={columns}
            data={orders}
            rowCount={rowCount}
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
