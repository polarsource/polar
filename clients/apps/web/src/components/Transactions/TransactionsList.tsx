import {
  Transaction,
  TransactionIssueReward,
  TransactionPledge,
  TransactionSubscription,
} from '@polar-sh/sdk'
import Link from 'next/link'
import {
  Avatar,
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
  FormattedDateTime,
} from 'polarkit/components/ui/atoms'
import {
  DataTableOnChangeFn,
  DataTablePaginationState,
  DataTableSortingState,
} from 'polarkit/datatable'
import { getCentsInDollarString } from 'polarkit/money'

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

const resolveTransactionMeta = (
  meta: TransactionSubscription | TransactionPledge | TransactionIssueReward,
) => {
  if ('subscription_tier' in meta) {
    return (
      <Link
        className="text-xs text-blue-500 dark:text-blue-400"
        href={`/${meta.subscription_tier.organization?.name}/subscriptions`}
      >
        {meta.subscription_tier.name}
      </Link>
    )
  } else if ('issue' in meta) {
    return (
      <Link
        className="text-xs text-blue-500 dark:text-blue-400"
        href={`/${meta.issue.organization?.name}/${meta.issue.repository.name}/issues/${meta.issue.number}`}
      >
        {meta.issue.title}
      </Link>
    )
  }
}

interface TransactionsListProps {
  transactions: Transaction[]
  pageCount: number
  pagination: DataTablePaginationState
  onPaginationChange?: DataTableOnChangeFn<DataTablePaginationState>
  sorting: DataTableSortingState
  onSortingChange?: DataTableOnChangeFn<DataTableSortingState>
}

const TransactionsList = ({
  transactions,
  pageCount,
  pagination,
  onPaginationChange,
  sorting,
  onSortingChange,
}: TransactionsListProps) => {
  const columns: DataTableColumnDef<Transaction>[] = [
    {
      accessorKey: 'created_at',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Date" />
      ),
      cell: (props) => {
        const datetime = props.getValue() as string
        return <FormattedDateTime datetime={datetime} displayTime />
      },
    },
    {
      id: 'description',
      enableSorting: false,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Description" />
      ),
      cell: (props) => {
        const transactionMeta = getTransactionMeta(props.row.original)
        return (
          <div className="flex gap-x-4">
            {transactionMeta.organization && (
              <Link
                className="hidden flex-shrink-0 md:block"
                href={`/${transactionMeta.organization.name}`}
              >
                <Avatar
                  className="h-10 w-10"
                  name={transactionMeta.organization?.name}
                  avatar_url={transactionMeta.organization?.avatar_url}
                />
              </Link>
            )}
            <div className="flex flex-col gap-y-1">
              <h3 className="text-sm">{transactionMeta.type}</h3>
              {transactionMeta.meta &&
                resolveTransactionMeta(transactionMeta.meta)}
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: 'amount',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Amount" />
      ),
      cell: (props) => (
        <>
          ${getCentsInDollarString(props.getValue() as number, undefined, true)}
        </>
      ),
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
    />
  )
}

export default TransactionsList
