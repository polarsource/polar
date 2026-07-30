'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { MiniMetricChartBox } from '@/components/Metrics/MiniMetricChartBox'
import { OrderStatus } from '@/components/Orders/OrderStatus'
import OrderStatusSelect from '@/components/Orders/OrderStatusSelect'
import ProductSelect from '@/components/Products/ProductSelect'
import { useMetrics } from '@/hooks/queries/metrics'
import { useOrders } from '@/hooks/queries/orders'
import { useDataTableQueryState } from '@/hooks/useDataTableQueryState'
import { getServerURL } from '@/utils/api'
import { getAPIParams } from '@/utils/datatable'
import { getChartRangeParams } from '@/utils/metrics'
import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined'
import { enums, schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import { Text } from '@polar-sh/orbit'
import { formatCurrency } from '@polar-sh/currency'
import { Truncated } from '@polar-sh/orbit'
import { Avatar } from '@polar-sh/orbit'
import { Button } from '@polar-sh/orbit'
import {
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
} from '@polar-sh/orbit'
import { Status } from '@polar-sh/orbit'
import { RowSelectionState } from '@tanstack/react-table'
import { useRouter } from 'next/navigation'
import {
  parseAsArrayOf,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from 'nuqs'
import React, { useEffect, useState } from 'react'

const filterParsers = {
  product_id: parseAsArrayOf(parseAsString),
  status: parseAsStringLiteral(enums.orderStatusValues),
  metadata: parseAsArrayOf(parseAsString),
}

/**
 * Invoice numbers are `{orgPrefix}-{seq}` or `{orgPrefix}-{customerShortId}-{seq}`.
 * Org prefix defaults to `slug.upper()` (may include hyphens, e.g. ACME-CORP).
 */
const formatInvoiceNumber = (
  invoiceNumber: string | null,
  organizationSlug: string,
) => {
  if (!invoiceNumber) return null
  const prefix = `${organizationSlug.toUpperCase()}-`
  if (invoiceNumber.startsWith(prefix)) {
    return invoiceNumber.slice(prefix.length)
  }
  return invoiceNumber
}

const formatOrderDate = (value: string) => {
  const date = new Date(value)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

interface ClientPageProps {
  organization: schemas['Organization']
}

const ClientPage: React.FC<ClientPageProps> = ({ organization }) => {
  const [selectedOrderState, setSelectedOrderState] =
    useState<RowSelectionState>({})

  const router = useRouter()

  const { pagination, setPagination, sorting, setSorting, resetPage } =
    useDataTableQueryState({
      defaultSorting: [{ id: 'created_at', desc: true }],
      defaultPageSize: 50,
    })

  const [{ product_id: productId, status, metadata }, setFilters] =
    useQueryStates(filterParsers)

  const onProductSelect = (value: string[]) => {
    setFilters({ product_id: value.length > 0 ? value : null })
    resetPage()
  }

  const onStatusSelect = (value: schemas['OrderStatus'] | null) => {
    setFilters({ status: value })
    resetPage()
  }

  const ordersHook = useOrders(organization.id, {
    ...getAPIParams(pagination, sorting),
    product_id: productId ?? undefined,
    status: status ? [status] : undefined,
  })

  const orders = ordersHook.data?.items || []
  const rowCount = ordersHook.data?.pagination.total_count ?? 0
  const pageCount = ordersHook.data?.pagination.max_page ?? 1

  const columns: DataTableColumnDef<schemas['Order']>[] = [
    {
      accessorKey: 'created_at',
      enableSorting: true,
      size: 120,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Invoice" />
      ),
      cell: ({ row: { original: order } }) => (
        <Box flexDirection="column" rowGap="xs" minWidth={0}>
          <Text>
            <time dateTime={order.created_at}>
              {formatOrderDate(order.created_at)}
            </time>
          </Text>
          <Text color="muted" monospace tabularNums>
            {formatInvoiceNumber(order.invoice_number, organization.slug) ??
              '—'}
          </Text>
        </Box>
      ),
    },
    {
      accessorKey: 'customer',
      enableSorting: true,
      size: 200,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Customer" />
      ),
      cell: (props) => {
        const customer = props.getValue() as schemas['OrderCustomer']
        const showBillingName =
          !!customer.billing_name &&
          customer.name?.toLocaleLowerCase() !==
          customer.billing_name.toLocaleLowerCase()
        return (
          <div className="flex flex-row items-center gap-2">
            <Avatar
              className="h-8 w-8"
              avatar_url={customer.avatar_url}
              name={customer.email ?? customer.name ?? '—'}
            />
            <Truncated>
              <Text as="span">
                {customer.name || customer.email || '—'}
                {showBillingName && (
                  <span className="dark:text-polar-500 ml-2 text-gray-500">
                    {customer.billing_name}
                  </span>
                )}
              </Text>
            </Truncated>
          </div>
        )
      },
    },
    {
      accessorKey: 'product',
      enableSorting: false,
      size: 200,
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Product"
          className="font-[550] text-black dark:text-white"
        />
      ),
      cell: ({
        row: {
          original: { product, description },
        },
      }) => {
        if (!product) {
          return (
            <Truncated>
              <Text as="span">{description}</Text>
            </Truncated>
          )
        }
        return (
          <div className="flex flex-row items-center gap-2">
            <Truncated>
              <Text as="span">{product.name}</Text>
            </Truncated>
            {product.is_archived && (
              <Status status="Archived" color="red" size="small" />
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'net_amount',
      enableSorting: true,
      size: 80,
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Amount"
          className="flex justify-end"
        />
      ),
      cell: ({ row: { original: order } }) => (
        <Box display="block" textAlign="right">
          <Text variant='default' tabularNums>
            {formatCurrency('accounting')(order.net_amount, order.currency)}
          </Text>
        </Box>
      ),
    },
    {
      accessorKey: 'status',
      enableSorting: true,
      size: 140,
      header: ({ column }) => (
        <div className="flex justify-end">
          <DataTableColumnHeader column={column} title="Status" />
        </div>
      ),
      cell: ({ row: { original: order } }) => (
        <div className="flex justify-end">
          <OrderStatus status={order.status} />
        </div>

      ),
    },
    ...(metadata
      ? metadata.map<DataTableColumnDef<schemas['Order']>>((key) => ({
        accessorKey: `metadata.${key}`,
        enableSorting: false,
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={key}
            className="text-black dark:text-white"
          />
        ),
        cell: (props) => <Text monospace>{props.getValue() as string}</Text>,
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
    product_id: productId ?? undefined,
    metrics: ['orders', 'revenue', 'average_order_value'],
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
          <Box alignItems="center" columnGap="m">
            <ProductSelect
              organization={organization}
              value={productId || []}
              onChange={onProductSelect}
              className="w-[300px]"
              includeArchived
            />
            <Box width={200}>
              <OrderStatusSelect value={status} onChange={onStatusSelect} />
            </Box>
          </Box>
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
            title="Revenue"
            value={metricsData?.totals.revenue}
            metric={metricsData?.metrics.revenue}
          />
          <MiniMetricChartBox
            title="Average Order Value"
            value={metricsData?.totals.average_order_value}
            metric={metricsData?.metrics.average_order_value}
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
