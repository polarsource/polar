'use client'

import { CatalogVersionLabel } from '@/components/Products/CatalogVersionLabel'
import {
  CondensedTableView,
  useCondensedTable,
  type CondensedTableColumn,
} from '@/components/Shared/CondensedTable'
import { CheckoutStatusDisplayTitle } from '@/utils/checkout'
import { CheckoutStatus } from './CheckoutStatus'
import { type DataTableSortingState } from '@/utils/datatable'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { type OnChangeFn } from '@tanstack/react-table'
import { format } from 'date-fns'

type Checkout = schemas['Checkout']

const EMPTY: Checkout[] = []

const formatDate = (date: string) => format(new Date(date), 'MMM d, yyyy')
const formatTime = (date: string) => format(new Date(date), 'HH:mm')

const getCustomerLabel = (checkout: Checkout) =>
  checkout.customer_name || checkout.customer_email || '—'

// The billing name, when it says more than the customer's own name.
const getBillingName = ({
  customer_name: name,
  customer_billing_name: billingName,
}: Checkout) =>
  name &&
  billingName &&
  name.toLocaleLowerCase() !== billingName.toLocaleLowerCase()
    ? billingName
    : null

const getProductLabel = ({ products }: Checkout) =>
  products.map(({ name }) => name).join(', ')

const CustomerCell = ({ checkout }: { checkout: Checkout }) => {
  const billingName = getBillingName(checkout)
  return (
    <>
      <Text truncate>{getCustomerLabel(checkout)}</Text>
      {billingName && (
        <Text color="muted" truncate>
          {billingName}
        </Text>
      )}
    </>
  )
}

const ProductCell = ({
  checkout,
  organization,
}: {
  checkout: Checkout
  organization: schemas['Organization']
}) => {
  const [product] = checkout.products
  return (
    <>
      <Text color="muted" truncate>
        {getProductLabel(checkout)}
      </Text>
      {checkout.products.length === 1 && (
        <CatalogVersionLabel organization={organization} version={product} />
      )}
    </>
  )
}

// A column with an accessor sorts by its id, which the list endpoint knows.
const getColumns = (
  organization: schemas['Organization'],
): CondensedTableColumn<Checkout>[] => [
  {
    accessorKey: 'created_at',
    header: 'Date',
    sortDescFirst: true,
    meta: { width: 144, skeleton: [120] },
    cell: ({ row: { original: checkout } }) => (
      <>
        <Text tabularNums wrap="nowrap">
          {formatDate(checkout.created_at)}
        </Text>
        <Text color="muted" tabularNums wrap="nowrap">
          {formatTime(checkout.created_at)}
        </Text>
      </>
    ),
  },
  {
    id: 'customer',
    header: 'Customer',
    meta: {
      grow: 2,
      minWidth: 120,
      skeleton: [140, 180, 120, 200, 160, 110, 190, 150, 130, 170],
    },
    cell: ({ row }) => <CustomerCell checkout={row.original} />,
  },
  {
    id: 'product',
    header: 'Product',
    meta: { grow: 2, minWidth: 96, skeleton: [90, 70, 100, 80, 60] },
    cell: ({ row }) => (
      <ProductCell checkout={row.original} organization={organization} />
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    meta: { width: 112, skeleton: [56, 64, 48] },
    cell: ({ row: { original: checkout } }) => (
      <CheckoutStatus status={checkout.status} />
    ),
  },
]

const CompactRow = ({ checkout }: { checkout: Checkout }) => (
  <>
    <Box alignItems="center" justifyContent="between" gap="m">
      <Box minWidth={0}>
        <Text truncate>{getCustomerLabel(checkout)}</Text>
      </Box>
      <Box flexShrink={0}>
        <Text color="muted">{CheckoutStatusDisplayTitle[checkout.status]}</Text>
      </Box>
    </Box>
    <Text variant="caption" color="muted" truncate>
      {getProductLabel(checkout)} · {formatDate(checkout.created_at)}
    </Text>
  </>
)

interface CheckoutsTableProps {
  organization: schemas['Organization']
  checkouts: Checkout[] | undefined
  sorting: DataTableSortingState
  onSortingChange: OnChangeFn<DataTableSortingState>
  onOpen: (id: string) => void
  footerLabel?: string
  isLoadingMore: boolean
  onEndReached: () => void
  onRetry?: () => void
}

export const CheckoutsTable = ({
  organization,
  checkouts,
  sorting,
  onSortingChange,
  onOpen,
  footerLabel,
  isLoadingMore,
  onEndReached,
  onRetry,
}: CheckoutsTableProps) => {
  const table = useCondensedTable({
    columns: getColumns(organization),
    rows: checkouts ?? EMPTY,
    getRowId: (checkout) => checkout.id,
    sorting,
    onSortingChange,
  })

  return (
    <CondensedTableView
      table={table}
      isLoading={checkouts === undefined}
      emptyLabel="No checkouts found"
      onOpen={onOpen}
      renderCompact={(checkout) => <CompactRow checkout={checkout} />}
      footerLabel={footerLabel}
      isLoadingMore={isLoadingMore}
      onEndReached={onEndReached}
      onRetry={onRetry}
    />
  )
}
