import { Transaction, TransactionType } from '@polar-sh/sdk'
import { useSearchTransactions } from 'polarkit/hooks'
import { getCentsInDollarString } from 'polarkit/money'
import { twMerge } from 'tailwind-merge'
import Pagination, { usePagination } from '../Shared/Pagination'

interface TransactionsListProps {
  accountId: string
  type: TransactionType
  pageSize: number
}

const TransactionsList = ({
  accountId,
  type,
  pageSize,
}: TransactionsListProps) => {
  const { currentPage, setCurrentPage } = usePagination()

  const transactions = useSearchTransactions({
    accountId: accountId,
    page: currentPage,
    type,
  })

  return (
    <Pagination
      currentPage={currentPage}
      totalCount={transactions.data?.pagination.total_count ?? 0}
      pageSize={pageSize}
      onPageChange={setCurrentPage}
    >
      <table className="-mx-4 w-full text-left">
        <thead className="dark:text-polar-500 text-gray-500">
          <tr className="text-sm">
            <th
              scope="col"
              className="relative isolate whitespace-nowrap px-4 py-3.5 pr-2 text-left font-normal"
            >
              Description
            </th>
            <th
              scope="col"
              className="relative isolate whitespace-nowrap px-4 py-3.5 pr-2 text-left font-normal"
            >
              Date
            </th>
            <th
              scope="col"
              className="relative isolate whitespace-nowrap px-4 py-3.5 pr-2 text-left font-normal"
            >
              Amount
            </th>
            <th
              scope="col"
              className="relative isolate whitespace-nowrap px-4 py-3.5 pr-2 font-normal"
            >
              Currency
            </th>
          </tr>
        </thead>
        <tbody>
          {transactions.data?.items?.map((transaction) => (
            <TransactionListItem transaction={transaction} />
          ))}
        </tbody>
      </table>
    </Pagination>
  )
}

export default TransactionsList

const useTransactionMeta = (transaction: Transaction) => {
  if (transaction.subscription) {
    return {
      type: `Subscription: ${transaction.subscription.subscription_tier.name}`,
      meta: transaction.subscription,
    }
  } else if (transaction.pledge) {
    return {
      type: `Pledge: ${transaction.pledge.issue.title}`,
      meta: transaction.pledge,
    }
  } else if (transaction.issue_reward) {
    return {
      type: 'Reward',
      meta: transaction.pledge,
    }
  } else {
    return {
      type: 'Transaction',
      meta: undefined,
    }
  }
}

interface TransactionListItemProps {
  transaction: Transaction
}

const TransactionListItem = ({ transaction }: TransactionListItemProps) => {
  const transactionMeta = useTransactionMeta(transaction)

  const childClass = twMerge(
    'dark:group-hover:bg-polar-700 p-4 capitalize transition-colors group-hover:bg-blue-50',
  )

  return (
    <tr className="group text-sm">
      <td className={twMerge(childClass, 'rounded-l-xl')}>
        <div className="flex flex-col gap-y-1">
          <h3 className="dark:text-polar-50 text-gray-950">
            {transactionMeta.type}
          </h3>
        </div>
      </td>
      <td className={childClass}>
        {new Date(transaction.created_at).toLocaleString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
      </td>
      <td className={childClass}>
        {getCentsInDollarString(transaction.amount, true, true)}
      </td>
      <td className={twMerge(childClass, 'rounded-r-xl uppercase')}>
        {transaction.currency}
      </td>
    </tr>
  )
}
