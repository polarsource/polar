import {
  DataTableOnChangeFn,
  DataTablePaginationState,
  DataTableSortingState,
} from '@/utils/datatable'
import { schemas } from '@polar-sh/client'
import {
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
  ReactQueryLoading,
} from '@polar-sh/ui/components/atoms/DataTable'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
import { useMemo } from 'react'
import ProductPill from '../Products/ProductPill'

const getTransactionMeta = (transaction: schemas['Transaction']) => {
  if (transaction.order) {
    return {
      type: transaction.order.subscription_id ? 'Subscription' : 'Purchase',
      meta: {
        product: transaction.order.product,
      },
    }
  } else if (transaction.issue_reward) {
    return {
      type: 'Reward',
      meta: transaction.pledge,
    }
  } else if (transaction.pledge) {
    return {
      type: 'Pledge',
      meta: transaction.pledge,
    }
  } else if (transaction.type === 'payout') {
    return {
      type: 'Payout',
      meta: undefined,
    }
  }
  return {
    type: transaction.type,
    meta: undefined,
  }
}

interface TransactionMetaProps {
  transaction: schemas['Transaction']
}

const TransactionMeta: React.FC<TransactionMetaProps> = ({ transaction }) => {
  const transactionMeta = useMemo(
    () => getTransactionMeta(transaction),
    [transaction],
  )

  return (
    <div className="flex items-start gap-2">
      <div className="flex flex-row gap-2">
        <div className="text-sm">{transactionMeta.type}</div>
        {transactionMeta.meta && (
          <>
            <div>—</div>
            {'product' in transactionMeta.meta &&
              transactionMeta.meta.product && (
                <>
                  <div>
                    <ProductPill product={transactionMeta.meta.product} />
                  </div>
                </>
              )}
            {'issue_reference' in transactionMeta.meta && (
              <div>{transactionMeta.meta.issue_reference}</div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export const platformFeesDisplayNames: {
  [key in schemas['PlatformFeeType']]: string
} = {
  payment: 'Payment fee',
  international_payment: 'International payment fee',
  subscription: 'Subscription fee',
  invoice: 'Invoice fee',
  cross_border_transfer: 'Cross-border transfer payout fee',
  payout: 'Payout fee',
  account: 'Active payout account fee',
  dispute: 'Dispute fee',
  platform: 'Polar fee',
}

interface TransactionsListProps {
  transactions: schemas['Transaction'][]
  rowCount: number
  pageCount: number
  pagination: DataTablePaginationState
  onPaginationChange?: DataTableOnChangeFn<DataTablePaginationState>
  sorting: DataTableSortingState
  onSortingChange?: DataTableOnChangeFn<DataTableSortingState>
  extraColumns?: DataTableColumnDef<
    schemas['Transaction'] | schemas['TransactionEmbedded']
  >[]
  isLoading: boolean | ReactQueryLoading
}

export const isTransaction = (
  t: schemas['Transaction'] | schemas['TransactionEmbedded'],
): t is schemas['Transaction'] =>
  t.hasOwnProperty('account_incurred_transactions')

const TransactionsList = ({
  transactions,
  rowCount,
  pageCount,
  pagination,
  onPaginationChange,
  sorting,
  onSortingChange,
  extraColumns,
  isLoading,
}: TransactionsListProps) => {
  const columns: DataTableColumnDef<
    schemas['Transaction'] | schemas['TransactionEmbedded']
  >[] = [
    {
      accessorKey: 'created_at',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Date" />
      ),
      cell: (props) => {
        const datetime = props.getValue() as string
        return <FormattedDateTime datetime={datetime} resolution="time" />
      },
    },
    {
      id: 'description',
      enableSorting: false,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Description" />
      ),
      cell: (props) => {
        const transaction = props.row.original
        if (isTransaction(transaction)) {
          return <TransactionMeta transaction={transaction} />
        } else if (transaction.platform_fee_type) {
          return (
            <div className="flex gap-x-4">
              <div className="flex flex-col gap-y-1">
                <h3 className="text-sm">
                  {platformFeesDisplayNames[transaction.platform_fee_type]}
                </h3>
              </div>
            </div>
          )
        }
      },
    },
    {
      accessorKey: 'amount',
      enableSorting: false,
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Gross"
          className="flex justify-end"
        />
      ),
      cell: (props) => {
        const { row } = props
        const { original: transaction } = row
        const amount = isTransaction(transaction)
          ? transaction.gross_amount
          : (props.getValue() as number)

        return (
          <div className="flex flex-row justify-end">
            {formatCurrencyAndAmount(amount, transaction.currency)}
          </div>
        )
      },
    },
    {
      id: 'incurred_amount',
      enableSorting: false,
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Fees"
          className="flex justify-end"
        />
      ),
      cell: (props) => {
        const { row } = props
        const { original: transaction } = row
        const incurredAmount = isTransaction(transaction)
          ? transaction.incurred_amount
          : undefined

        return (
          <div className="flex justify-end">
            {incurredAmount !== undefined
              ? formatCurrencyAndAmount(incurredAmount, transaction.currency)
              : '—'}
          </div>
        )
      },
    },
    {
      id: 'net',
      enableSorting: false,
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Net"
          className="flex justify-end"
        />
      ),
      cell: (props) => {
        const { row } = props
        const { original: transaction } = row
        const netAmount = isTransaction(transaction)
          ? transaction.net_amount
          : undefined

        return (
          <div className="flex justify-end">
            {netAmount !== undefined
              ? formatCurrencyAndAmount(netAmount, transaction.currency)
              : '—'}
          </div>
        )
      },
    },
    ...(extraColumns || []),
  ]

  return (
    <DataTable
      columns={columns}
      data={transactions}
      rowCount={rowCount}
      pageCount={pageCount}
      pagination={pagination}
      onPaginationChange={onPaginationChange}
      sorting={sorting}
      onSortingChange={onSortingChange}
      getSubRows={(row) =>
        isTransaction(row) ? row.account_incurred_transactions : undefined
      }
      isLoading={isLoading}
      onRowClick={(row) => row.getToggleExpandedHandler()()}
    />
  )
}

export default TransactionsList
