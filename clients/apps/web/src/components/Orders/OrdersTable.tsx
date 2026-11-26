'use client'

import { CustomerEntityLink } from '@/components/Customer/CustomerEntityLink'
import { EventTimestamp } from '@/components/Events/EventTimestamp'
import { CatalogVersionLabel } from '@/components/Products/CatalogVersionLabel'
import { ProductEntityLink } from '@/components/Products/ProductEntityLink'
import {
  CondensedTableView,
  useCondensedTable,
  type CondensedTableColumn,
} from '@/components/Shared/CondensedTable'
import { type DataTableSortingState } from '@/utils/datatable'
import { formatMetadataValue } from '@/utils/formatters'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { type OnChangeFn } from '@tanstack/react-table'
import { format } from 'date-fns'
import { OrderStatus, OrderStatusDisplayTitle } from './OrderStatus'

type Order = schemas['Order']

const EMPTY: Order[] = []

const formatDate = (date: string) => format(new Date(date), 'MMM d, yyyy')

const formatAmount = (order: Order) =>
  formatCurrency('accounting')(order.net_amount, order.currency)

const getCustomerLabel = ({ customer }: Order) =>
  customer.name || customer.email || '—'

const getProductLabel = ({ product, description }: Order) =>
  product?.name ?? description

const CustomerCell = ({
  order,
  organization,
}: {
  order: Order
  organization: schemas['Organization']
}) => (
  <CustomerEntityLink
    organization={organization}
    customer={order.customer}
    withBillingName
  />
)

const ProductCell = ({
  order,
  organization,
}: {
  order: Order
  organization: schemas['Organization']
}) => (
  <>
    {order.product ? (
      <ProductEntityLink
        organization={organization}
        product={order.product}
        filterable
      />
    ) : (
      <Text color="muted" truncate>
        {getProductLabel(order)}
      </Text>
    )}
    {order.product && (
      <CatalogVersionLabel
        organization={organization}
        version={order.product}
      />
    )}
    {order.product?.is_archived && (
      <Status status="Archived" color="red" size="small" />
    )}
  </>
)

// Each id is the key the list endpoint sorts by.
const getColumns = (
  organization: schemas['Organization'],
  metadataKeys: string[],
): CondensedTableColumn<Order>[] => [
  {
    accessorKey: 'created_at',
    header: 'Date',
    sortDescFirst: true,
    meta: { width: 172, skeleton: [120] },
    cell: ({ row: { original: order } }) => (
      <EventTimestamp
        timestamp={order.created_at}
        format="datetime"
        focusable={false}
      />
    ),
  },
  {
    id: 'customer',
    accessorFn: getCustomerLabel,
    header: 'Customer',
    meta: {
      grow: 2,
      minWidth: 120,
      skeleton: [140, 180, 120, 200, 160, 110, 190, 150, 130, 170],
    },
    cell: ({ row }) => (
      <CustomerCell order={row.original} organization={organization} />
    ),
  },
  {
    id: 'product',
    accessorFn: getProductLabel,
    header: 'Product',
    meta: { grow: 2, minWidth: 96, skeleton: [90, 70, 100, 80, 60] },
    cell: ({ row }) => (
      <ProductCell order={row.original} organization={organization} />
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    meta: { width: 136, skeleton: [56, 64, 48] },
    cell: ({ row }) => <OrderStatus status={row.original.status} />,
  },
  ...metadataKeys.map<CondensedTableColumn<Order>>((key) => ({
    id: `metadata.${key}`,
    header: key,
    meta: { minWidth: 72 },
    cell: ({ row }) => (
      <Text monospace color="muted" truncate>
        {formatMetadataValue(row.original.metadata[key])}
      </Text>
    ),
  })),
  {
    accessorKey: 'net_amount',
    header: 'Amount',
    sortDescFirst: true,
    meta: { width: 112, align: 'end', skeleton: [72, 64, 80] },
    cell: ({ row }) => (
      <Text tabularNums wrap="nowrap">
        {formatAmount(row.original)}
      </Text>
    ),
  },
]

const CompactRow = ({ order }: { order: Order }) => (
  <>
    <Box alignItems="center" justifyContent="between" gap="m">
      <Box minWidth={0}>
        <Text truncate>{getCustomerLabel(order)}</Text>
      </Box>
      <Box flexShrink={0}>
        <Text tabularNums>{formatAmount(order)}</Text>
      </Box>
    </Box>
    <Text variant="caption" color="muted" truncate>
      {getProductLabel(order)} · {OrderStatusDisplayTitle[order.status]} ·{' '}
      {formatDate(order.created_at)}
    </Text>
  </>
)

interface OrdersTableProps {
  organization: schemas['Organization']
  orders: Order[] | undefined
  metadataKeys: string[]
  sorting: DataTableSortingState
  onSortingChange: OnChangeFn<DataTableSortingState>
  onOpen: (id: string) => void
  footerLabel?: string
  isLoadingMore: boolean
  onEndReached: () => void
  onRetry?: () => void
}

export const OrdersTable = ({
  organization,
  orders,
  metadataKeys,
  sorting,
  onSortingChange,
  onOpen,
  footerLabel,
  isLoadingMore,
  onEndReached,
  onRetry,
}: OrdersTableProps) => {
  const table = useCondensedTable({
    columns: getColumns(organization, metadataKeys),
    rows: orders ?? EMPTY,
    getRowId: (order) => order.id,
    sorting,
    onSortingChange,
  })
  return (
    <CondensedTableView
      table={table}
      isLoading={orders === undefined}
      emptyLabel="No orders found"
      onOpen={onOpen}
      renderCompact={(order) => <CompactRow order={order} />}
      footerLabel={footerLabel}
      isLoadingMore={isLoadingMore}
      onEndReached={onEndReached}
      onRetry={onRetry}
    />
  )
}
