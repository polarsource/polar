import { Transaction } from '@polar-sh/sdk'
import { getCentsInDollarString } from 'polarkit/money'
import { twMerge } from 'tailwind-merge'

interface TransactionsListProps {
  transactions: Transaction[]
}

const TransactionsList = ({ transactions }: TransactionsListProps) => {
  return (
    <table className="-mx-4 w-full text-left">
      <thead className="dark:text-polar-500 text-gray-500">
        <tr className="text-sm">
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
            Description
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
        {transactions.map((transaction) => (
          <TransactionListItem key={transaction.id} transaction={transaction} />
        ))}
      </tbody>
    </table>
  )
}

export default TransactionsList

const useTransactionMeta = (transaction: Transaction) => {
  if (transaction.subscription) {
    return {
      type: 'Subscription',
      meta: transaction.subscription.subscription_tier.name,
    }
  } else if (transaction.pledge) {
    return {
      type: 'Pledge',
      meta: transaction.pledge.issue.title,
    }
  } else if (transaction.issue_reward) {
    return {
      type: 'Reward',
      meta: transaction.issue_reward.issue_id,
    }
  } else {
    return {
      type: transaction.type,
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
    'dark:group-hover:bg-polar-700 px-4 py-2 capitalize transition-colors group-hover:bg-blue-50 group-hover:text-gray-950 text-gray-700 dark:text-polar-200 group-hover:dark:text-polar-50',
  )

  return (
    <tr className="group text-sm">
      <td className={twMerge(childClass, 'rounded-l-xl')}>
        {new Date(transaction.created_at).toLocaleString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
      </td>
      <td className={twMerge(childClass, 'flex flex-col gap-y-1')}>
        <h3>{transactionMeta.type}</h3>
        <p className="dark:text-polar-500 text-xs text-gray-500">
          {transactionMeta.meta}
        </p>
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
