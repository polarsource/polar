import {
  DataTableOnChangeFn,
  DataTablePaginationState,
  DataTableSortingState,
} from '@/utils/datatable'
import { isTransaction, platformFeesDisplayNames } from '@/utils/transaction'
import { ISODuration } from '@/utils/duration'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import {
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
  ReactQueryLoading,
} from '@polar-sh/ui/components/atoms/DataTable'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/ui/components/ui/tooltip'
import TransactionMeta from './TransactionMeta'
import { TransactionAvailabilityStatus } from './TransactionAvailabilityStatus'

interface TransactionsListProps {
  transactions: schemas['Transaction'][]
  rowCount: number
  pageCount: number
  pagination: DataTablePaginationState
  onPaginationChange?: DataTableOnChangeFn<DataTablePaginationState>
  sorting: DataTableSortingState
  onSortingChange?: DataTableOnChangeFn<DataTableSortingState>
  isLoading: boolean | ReactQueryLoading
  payoutTransactionDelay: ISODuration | null
}

const TransactionsList = ({
  transactions,
  rowCount,
  pageCount,
  pagination,
  onPaginationChange,
  sorting,
  onSortingChange,
  isLoading,
  payoutTransactionDelay,
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
        return (
          <div className="whitespace-nowrap">
            <FormattedDateTime datetime={datetime} resolution="time" />
          </div>
        )
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
              <div className="flex flex-row items-center gap-x-2">
                <span className="text-sm">→</span>
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
      id: 'gross_amount',
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
        const paymentTransaction = isTransaction(transaction)
          ? transaction.payment_transaction
          : null

        if (!paymentTransaction) {
          return <div className="flex flex-row justify-end">—</div>
        }

        const amount = paymentTransaction.amount + paymentTransaction.tax_amount

        return (
          <div className="flex flex-row justify-end">
            {paymentTransaction.presentment_currency !==
            transaction.currency ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="underline decoration-dotted">
                    {formatCurrency('accounting')(amount, transaction.currency)}
                  </span>
                </TooltipTrigger>
                <TooltipContent className="flex flex-col gap-1.5">
                  <div className="flex justify-between gap-6">
                    <span className="dark:text-polar-400 text-gray-500">
                      Presentment amount
                    </span>
                    <span>
                      {formatCurrency('accounting')(
                        (paymentTransaction.presentment_amount ?? 0) +
                          (paymentTransaction.presentment_tax_amount ?? 0),
                        paymentTransaction.presentment_currency ??
                          paymentTransaction.currency,
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between gap-6">
                    <span className="dark:text-polar-400 text-gray-500 uppercase">
                      FX (
                      {paymentTransaction.presentment_currency ??
                        paymentTransaction.currency}{' '}
                      → {transaction.currency})
                    </span>
                    <span>{paymentTransaction.exchange_rate}</span>
                  </div>
                </TooltipContent>
              </Tooltip>
            ) : (
              formatCurrency('accounting')(amount, transaction.currency)
            )}
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
          : transaction.amount

        return (
          <div className="flex justify-end">
            {incurredAmount !== undefined ? (
              <>
                {formatCurrency('accounting')(
                  incurredAmount,
                  transaction.currency,
                )}
              </>
            ) : (
              '—'
            )}
          </div>
        )
      },
    },
    {
      id: 'tax',
      enableSorting: false,
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Tax"
          className="flex justify-end"
        />
      ),
      cell: (props) => {
        const { row } = props
        const { original: transaction } = row
        const paymentTransaction = isTransaction(transaction)
          ? transaction.payment_transaction
          : null

        if (!paymentTransaction) {
          return <div className="flex justify-end">—</div>
        }

        return (
          <div className="flex justify-end">
            {paymentTransaction.presentment_currency !==
            transaction.currency ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="underline decoration-dotted">
                    {formatCurrency('accounting')(
                      -paymentTransaction.tax_amount,
                      transaction.currency,
                    )}
                  </span>
                </TooltipTrigger>
                <TooltipContent className="flex flex-col gap-1.5">
                  <div className="flex justify-between gap-6">
                    <span className="dark:text-polar-400 text-gray-500">
                      Presentment amount
                    </span>
                    <span>
                      {formatCurrency('accounting')(
                        paymentTransaction.presentment_tax_amount ?? 0,
                        paymentTransaction.presentment_currency ??
                          paymentTransaction.currency,
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between gap-6">
                    <span className="dark:text-polar-400 text-gray-500 uppercase">
                      FX (
                      {paymentTransaction.presentment_currency ??
                        paymentTransaction.currency}{' '}
                      → {transaction.currency})
                    </span>
                    <span>{paymentTransaction.exchange_rate}</span>
                  </div>
                </TooltipContent>
              </Tooltip>
            ) : (
              formatCurrency('accounting')(
                -paymentTransaction.tax_amount,
                paymentTransaction.currency,
              )
            )}
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
              ? formatCurrency('accounting')(netAmount, transaction.currency)
              : '—'}
          </div>
        )
      },
    },
    {
      id: 'status',
      enableSorting: false,
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Status"
          className="flex justify-end"
        />
      ),
      cell: (props) => {
        const transaction = props.row.original
        return (
          <div className="flex justify-end">
            <TransactionAvailabilityStatus
              transaction={transaction}
              delay={payoutTransactionDelay}
            />
          </div>
        )
      },
    },
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
