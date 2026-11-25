import { EventTimestamp } from '@/components/Events/EventTimestamp'
import { getProductHref } from '@/components/Products/ProductEntityLink'
import { type CondensedTableColumn } from '@/components/Shared/CondensedTable'
import { EntityLink } from '@/components/Shared/EntityLink'
import { ISODuration } from '@/utils/duration'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { IncomeAmount } from './IncomeAmount'
import { IncomeStatus } from './IncomeStatus'

type Transaction = schemas['Transaction']

const format = formatCurrency('accounting')

export const getIncomeLabel = (transaction: Transaction) => {
  if (transaction.order) {
    return transaction.order.subscription_id ? 'Subscription' : 'Purchase'
  }
  if (transaction.issue_reward) return 'Reward'
  if (transaction.pledge) return 'Pledge'
  return transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)
}

export const formatIncomeNet = (transaction: Transaction) =>
  format(transaction.net_amount, transaction.currency)

const DescriptionCell = ({
  transaction,
  organization,
}: {
  transaction: Transaction
  organization: schemas['Organization']
}) => {
  const product = transaction.order?.product
  return (
    <>
      <Box flexShrink={0}>
        <Text>{getIncomeLabel(transaction)}</Text>
      </Box>
      {transaction.order && product && (
        <EntityLink
          kind="product"
          href={getProductHref(organization, product)}
          menuItems={[
            {
              label: 'View order',
              href: `/dashboard/${organization.slug}/sales/${transaction.order.id}`,
            },
            { label: 'Copy product ID', copy: product.id },
          ]}
          muted
        >
          {product.name}
        </EntityLink>
      )}
    </>
  )
}

const Empty = () => <Text color="muted">—</Text>

// The id of the date column is the key the list endpoint sorts by.
export const getIncomeColumns = (
  organization: schemas['Organization'],
  payoutTransactionDelay: ISODuration | null,
): CondensedTableColumn<Transaction>[] => [
  {
    accessorKey: 'created_at',
    header: 'Date',
    sortDescFirst: true,
    meta: { width: 172, skeleton: [120] },
    cell: ({ row }) => (
      <EventTimestamp
        timestamp={row.original.created_at}
        format="datetime"
        focusable={false}
      />
    ),
  },
  {
    id: 'description',
    header: 'Description',
    meta: {
      grow: 2,
      minWidth: 160,
      skeleton: [180, 140, 200, 160, 120, 190],
    },
    cell: ({ row }) => (
      <DescriptionCell transaction={row.original} organization={organization} />
    ),
  },
  {
    id: 'status',
    header: 'Status',
    meta: { width: 136, skeleton: [56, 64, 48] },
    cell: ({ row }) => (
      <IncomeStatus transaction={row.original} delay={payoutTransactionDelay} />
    ),
  },
  {
    id: 'gross',
    header: 'Gross',
    meta: { width: 104, align: 'end', skeleton: [64, 72, 56] },
    cell: ({ row: { original: transaction } }) => {
      const payment = transaction.payment_transaction
      return payment ? (
        <IncomeAmount
          amount={payment.amount + payment.tax_amount}
          currency={transaction.currency}
          presentmentAmount={
            (payment.presentment_amount ?? 0) +
            (payment.presentment_tax_amount ?? 0)
          }
          payment={payment}
        />
      ) : (
        <Empty />
      )
    },
  },
  {
    id: 'fees',
    header: 'Fees',
    meta: { width: 96, align: 'end', skeleton: [48, 56, 40] },
    cell: ({ row: { original: transaction } }) => (
      <Text tabularNums wrap="nowrap">
        {format(transaction.incurred_amount, transaction.currency)}
      </Text>
    ),
  },
  {
    id: 'tax',
    header: 'Tax',
    meta: { width: 96, align: 'end', skeleton: [40, 48] },
    cell: ({ row: { original: transaction } }) => {
      const payment = transaction.payment_transaction
      return payment ? (
        <IncomeAmount
          amount={-payment.tax_amount}
          currency={transaction.currency}
          presentmentAmount={payment.presentment_tax_amount ?? 0}
          payment={payment}
        />
      ) : (
        <Empty />
      )
    },
  },
  {
    id: 'net',
    header: 'Net',
    meta: { width: 104, align: 'end', skeleton: [64, 72, 56] },
    cell: ({ row }) => (
      <Text tabularNums wrap="nowrap">
        {formatIncomeNet(row.original)}
      </Text>
    ),
  },
]
