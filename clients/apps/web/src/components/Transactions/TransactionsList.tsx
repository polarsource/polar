import {
  KeyboardArrowDownOutlined,
  KeyboardArrowRightOutlined,
} from '@mui/icons-material'
import {
  PlatformFeeType,
  Transaction,
  TransactionEmbedded,
} from '@polar-sh/sdk'
import Link from 'next/link'
import { FormattedDateTime } from 'polarkit/components/ui/atoms'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import {
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
} from 'polarkit/components/ui/atoms/datatable'
import {
  DataTableOnChangeFn,
  DataTablePaginationState,
  DataTableSortingState,
} from 'polarkit/datatable'
import { formatCurrencyAndAmount } from 'polarkit/money'
import { useMemo } from 'react'

const getTransactionMeta = (transaction: Transaction) => {
  if (transaction.subscription) {
    return {
      type: 'Subscription',
      organization: transaction.subscription?.subscription_tier.organization,
      meta: transaction.subscription,
    }
  } else if (transaction.issue_reward) {
    return {
      type: 'Reward',
      organization: transaction.pledge?.issue.organization,
      meta: transaction.pledge,
    }
  } else if (transaction.pledge) {
    return {
      type: 'Pledge',
      organization: transaction.pledge?.issue.organization,
      meta: transaction.pledge,
    }
  } else {
    return {
      type: transaction.type,
      meta: undefined,
    }
  }
}

interface TransactionMetaProps {
  transaction: Transaction
}

const TransactionMeta: React.FC<TransactionMetaProps> = ({ transaction }) => {
  const transactionMeta = useMemo(
    () => getTransactionMeta(transaction),
    [transaction],
  )

  return (
    <div className="flex items-center gap-2">
      {transactionMeta.organization && (
        <Link
          className="hidden flex-shrink-0 md:block"
          href={`/${transactionMeta.organization.name}`}
        >
          <Avatar
            className="h-6 w-6"
            name={transactionMeta.organization?.name}
            avatar_url={transactionMeta.organization?.avatar_url}
          />
        </Link>
      )}
      <div className="flex flex-row gap-2">
        <div className="text-sm">{transactionMeta.type}</div>
        {transactionMeta.meta && (
          <>
            <div>—</div>
            {'subscription_tier' in transactionMeta.meta && (
              <div>
                <Link
                  className=" text-blue-500 dark:text-blue-400"
                  href={`/${transactionMeta.meta.subscription_tier.organization?.name}/subscriptions`}
                >
                  {transactionMeta.meta.subscription_tier.name}
                </Link>
              </div>
            )}
            {'issue' in transactionMeta.meta && (
              <div>
                <Link
                  className=" text-blue-500 dark:text-blue-400"
                  href={`/${transactionMeta.meta.issue.organization?.name}/${transactionMeta.meta.issue.repository.name}/issues/${transactionMeta.meta.issue.number}`}
                >
                  {transactionMeta.meta.issue.title}
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export const platformFeesDisplayNames: {
  [key in PlatformFeeType]: string
} = {
  [PlatformFeeType.PLATFORM]: 'Polar fee',
  [PlatformFeeType.PAYMENT]: 'Payment processor fee: credit card',
  [PlatformFeeType.SUBSCRIPTION]:
    'Payment processor fee: recurring subscription',
  [PlatformFeeType.INVOICE]: 'Payment processor fee: invoice',
  [PlatformFeeType.CROSS_BORDER_TRANSFER]:
    'Payment processor fee: cross-border transfer',
  [PlatformFeeType.PAYOUT]: 'Payment processor fee: payout',
  [PlatformFeeType.ACCOUNT]: 'Payment processor fee: active account',
}

interface TransactionsListProps {
  transactions: Transaction[]
  pageCount: number
  pagination: DataTablePaginationState
  onPaginationChange?: DataTableOnChangeFn<DataTablePaginationState>
  sorting: DataTableSortingState
  onSortingChange?: DataTableOnChangeFn<DataTableSortingState>
}

const isTransaction = (
  t: Transaction | TransactionEmbedded,
): t is Transaction => t.hasOwnProperty('account_incurred_transactions')

const TransactionsList = ({
  transactions,
  pageCount,
  pagination,
  onPaginationChange,
  sorting,
  onSortingChange,
}: TransactionsListProps) => {
  const columns: DataTableColumnDef<Transaction | TransactionEmbedded>[] = [
    {
      id: 'expand',
      enableSorting: false,
      cell: ({ row }) => {
        if (!row.getCanExpand()) return null

        return (
          <button
            {...{
              onClick: row.getToggleExpandedHandler(),
              style: { cursor: 'pointer' },
            }}
          >
            {row.getIsExpanded() ? (
              <KeyboardArrowDownOutlined />
            ) : (
              <KeyboardArrowRightOutlined />
            )}
          </button>
        )
      },
    },
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
  ]

  return (
    <DataTable
      columns={columns}
      data={transactions}
      pageCount={pageCount}
      pagination={pagination}
      onPaginationChange={onPaginationChange}
      sorting={sorting}
      onSortingChange={onSortingChange}
      getSubRows={(row) =>
        isTransaction(row) ? row.account_incurred_transactions : undefined
      }
    />
  )
}

export default TransactionsList
