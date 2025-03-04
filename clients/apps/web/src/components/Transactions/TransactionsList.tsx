import {
  DataTableOnChangeFn,
  DataTablePaginationState,
  DataTableSortingState,
} from '@/utils/datatable'
import {
  KeyboardArrowDownOutlined,
  KeyboardArrowRightOutlined,
} from '@mui/icons-material'
import { schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import {
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
  ReactQueryLoading,
} from '@polar-sh/ui/components/atoms/DataTable'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
import Link from 'next/link'
import { useMemo } from 'react'
import ProductPill from '../Products/ProductPill'

const getTransactionMeta = (transaction: schemas['Transaction']) => {
  if (transaction.order) {
    return {
      type: transaction.order.subscription_id ? 'Subscription' : 'Purchase',
      organization: transaction.order.product.organization,
      meta: {
        product: transaction.order.product,
        price: transaction.order.product_price,
      },
    }
  } else if (transaction.issue_reward) {
    return {
      type: 'Reward',
      externalOrganization: transaction.pledge?.issue.organization,
      meta: transaction.pledge,
    }
  } else if (transaction.pledge) {
    return {
      type: 'Pledge',
      externalOrganization: transaction.pledge?.issue.organization,
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
      {transactionMeta.organization && (
        <Link
          className="hidden flex-shrink-0 md:block"
          href={`/${transactionMeta.organization.slug}`}
        >
          <Avatar
            className="h-6 w-6"
            name={transactionMeta.organization.name}
            avatar_url={transactionMeta.organization.avatar_url}
          />
        </Link>
      )}
      {transactionMeta.externalOrganization && (
        <div className="hidden flex-shrink-0 md:block">
          <Avatar
            className="h-6 w-6"
            name={transactionMeta.externalOrganization.name}
            avatar_url={transactionMeta.externalOrganization.avatar_url}
          />
        </div>
      )}

      <div className="flex flex-row gap-2">
        <div className="text-sm">{transactionMeta.type}</div>
        {transactionMeta.meta && (
          <>
            <div>—</div>
            {'product' in transactionMeta.meta && (
              <>
                <div>
                  <Link
                    className="text-blue-500 dark:text-blue-400"
                    href={`/dashboard/${transactionMeta.organization?.slug}/products/${transactionMeta.meta.product.id}`}
                  >
                    <ProductPill
                      product={transactionMeta.meta.product}
                      price={transactionMeta.meta.price}
                    />
                  </Link>
                </div>
              </>
            )}
            {'issue' in transactionMeta.meta && (
              <div>
                <Link
                  className="text-blue-500 dark:text-blue-400"
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
    ...(extraColumns || []),
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
      isLoading={isLoading}
    />
  )
}

export default TransactionsList
