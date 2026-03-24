import {
  DataTableOnChangeFn,
  DataTablePaginationState,
  DataTableSortingState,
} from '@/utils/datatable'
import { isTransaction, platformFeesDisplayNames } from '@/utils/transaction'
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
import { InfoIcon } from 'lucide-react'
import TransactionMeta from './TransactionMeta'

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
            {formatCurrency('accounting')(amount, transaction.currency)}
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
        const paymentTransaction = isTransaction(transaction)
          ? transaction.payment_transaction
          : undefined

        return (
          <div className="flex justify-end">
            {incurredAmount !== undefined ? (
              <>
                {formatCurrency('accounting')(
                  incurredAmount,
                  transaction.currency,
                )}
                {paymentTransaction && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <InfoIcon className="dark:text-polar-400 ml-1 h-3.5 w-3.5 cursor-pointer self-center text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent className="flex flex-col gap-1.5">
                      <div className="flex justify-between gap-6">
                        <span className="dark:text-polar-400 text-gray-500">
                          Customer paid
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
                        <span className="dark:text-polar-400 text-gray-500">
                          Fee basis
                        </span>
                        <span>
                          {formatCurrency('accounting')(
                            paymentTransaction.amount +
                              paymentTransaction.tax_amount,
                            paymentTransaction.currency,
                          )}
                        </span>
                      </div>
                    </TooltipContent>
                  </Tooltip>
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
