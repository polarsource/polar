import {
  DataTableOnChangeFn,
  DataTablePaginationState,
  DataTableSortingState,
} from '@/utils/datatable'
import {
  KeyboardArrowDownOutlined,
  KeyboardArrowRightOutlined,
} from '@mui/icons-material'
import {
  PlatformFeeType,
  Transaction,
  TransactionEmbedded,
  TransactionType,
} from '@polar-sh/sdk'
import Link from 'next/link'
import { FormattedDateTime } from 'polarkit/components/ui/atoms'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import {
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
  ReactQueryLoading,
} from 'polarkit/components/ui/atoms/datatable'
import { formatCurrencyAndAmount } from 'polarkit/lib/money'
import { useMemo } from 'react'
import ProductPill from '../Products/ProductPill'

const getTransactionMeta = (transaction: Transaction) => {
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
  } else if (transaction.donation) {
    return {
      type: 'Donation',
      organization: transaction.donation.to_organization,
      meta: transaction.donation,
    }
  } else if (transaction.type === TransactionType.PAYOUT) {
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
  transaction: Transaction
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
                    className=" text-blue-500 dark:text-blue-400"
                    href={`/${transactionMeta.organization?.slug}/products/${transactionMeta.meta.product.id}`}
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
                  className=" text-blue-500 dark:text-blue-400"
                  href={`/${transactionMeta.meta.issue.organization?.name}/${transactionMeta.meta.issue.repository.name}/issues/${transactionMeta.meta.issue.number}`}
                >
                  {transactionMeta.meta.issue.title}
                </Link>
              </div>
            )}
            {transactionMeta.type === 'Donation' &&
            'to_organization' in transactionMeta.meta &&
            transactionMeta.meta.to_organization ? (
              <div className="flex flex-col gap-1">
                <Link
                  className=" text-blue-500 dark:text-blue-400"
                  href={`/${transactionMeta.meta.to_organization.slug}`}
                >
                  {transactionMeta.meta.to_organization.slug}
                </Link>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

export const platformFeesDisplayNames: {
  [key in PlatformFeeType]: string
} = {
  [PlatformFeeType.PAYMENT]: 'Payment fee',
  [PlatformFeeType.INTERNATIONAL_PAYMENT]: 'International payment fee',
  [PlatformFeeType.SUBSCRIPTION]: 'Subscription fee',
  [PlatformFeeType.INVOICE]: 'Invoice fee',
  [PlatformFeeType.CROSS_BORDER_TRANSFER]: 'Cross-border transfer payout fee',
  [PlatformFeeType.PAYOUT]: 'Payout fee',
  [PlatformFeeType.ACCOUNT]: 'Active payout account fee',
  [PlatformFeeType.PLATFORM]: 'Polar fee',
}

interface TransactionsListProps {
  transactions: Transaction[]
  pageCount: number
  pagination: DataTablePaginationState
  onPaginationChange?: DataTableOnChangeFn<DataTablePaginationState>
  sorting: DataTableSortingState
  onSortingChange?: DataTableOnChangeFn<DataTableSortingState>
  extraColumns?: DataTableColumnDef<Transaction | TransactionEmbedded>[]
  isLoading: boolean | ReactQueryLoading
}

export const isTransaction = (
  t: Transaction | TransactionEmbedded,
): t is Transaction => t.hasOwnProperty('account_incurred_transactions')

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
