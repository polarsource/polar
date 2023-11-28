import { Transaction, TransactionType } from '@polar-sh/sdk'
import { useSearchTransactions } from 'polarkit/hooks'
import { getCentsInDollarString } from 'polarkit/money'
import Pagination, { usePagination } from '../Shared/Pagination'

interface TransactionsListProps {
  accountId: string
  type: TransactionType
  payoutsOnly?: boolean
  pageSize: number
}

const TransactionsList = ({
  accountId,
  type,
  payoutsOnly,
  pageSize,
}: TransactionsListProps) => {
  const { currentPage, setCurrentPage } = usePagination()

  const transactions = useSearchTransactions({
    accountId: accountId,
    page: currentPage,
    type,
  })

  console.log(transactions.data?.items)
  console.log(accountId)

  return (
    <Pagination
      currentPage={currentPage}
      totalCount={transactions.data?.pagination.total_count ?? 0}
      pageSize={pageSize}
      onPageChange={setCurrentPage}
    >
      <table className="w-full text-left">
        <thead className="dark:text-polar-400 text-gray-900">
          <tr>
            <th
              scope="col"
              className="relative isolate whitespace-nowrap py-3.5 pr-2 text-left text-sm font-semibold"
            >
              Description
            </th>
            <th
              scope="col"
              className="relative isolate whitespace-nowrap py-3.5 pr-2 text-left text-sm font-semibold"
            >
              Creation Date
            </th>
            <th
              scope="col"
              className="relative isolate whitespace-nowrap py-3.5 pr-2 text-left text-sm font-semibold"
            >
              Type
            </th>
            <th
              scope="col"
              className="relative isolate whitespace-nowrap py-3.5 pr-2 text-left text-sm font-medium"
            >
              Amount
            </th>
            <th
              scope="col"
              className="relative isolate whitespace-nowrap py-3.5 pr-2 text-sm font-semibold"
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

  return (
    <tr>
      <td className="capitalize">
        <div className="flex flex-col gap-y-1">
          <h3 className="dark:text-polar-50 text-gray-950">
            {transactionMeta.type}
          </h3>
        </div>
      </td>
      <td>
        {new Date(transaction.created_at).toLocaleString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
      </td>
      <td className="capitalize">{transaction.type}</td>
      <td>{getCentsInDollarString(transaction.amount, true, true)}</td>
      <td className="uppercase">{transaction.currency}</td>
    </tr>
  )
}
