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

const CustomerCell = ({
  checkout,
  organization,
}: {
  checkout: Checkout
  organization: schemas['Organization']
}) => {
  const billingName = getBillingName(checkout)
  return (
    <>
      {/* A checkout has a customer once someone is known to be behind it. */}
      {checkout.customer_id ? (
        <CustomerEntityLink
          organization={organization}
          customer={{
            id: checkout.customer_id,
            name: checkout.customer_name,
            email: checkout.customer_email,
          }}
          filterable
        />
      ) : (
        <Text truncate>{getCustomerLabel(checkout)}</Text>
      )}
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
      {checkout.products.length === 1 ? (
        <ProductEntityLink organization={organization} product={product} />
      ) : (
        <Text color="muted" truncate>
          {getProductLabel(checkout)}
        </Text>
      )}
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
    meta: { width: 172, skeleton: [120] },
    cell: ({ row: { original: checkout } }) => (
      <EventTimestamp
        timestamp={checkout.created_at}
        format="datetime"
        focusable={false}
      />
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
    cell: ({ row }) => (
      <CustomerCell checkout={row.original} organization={organization} />
    ),
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
