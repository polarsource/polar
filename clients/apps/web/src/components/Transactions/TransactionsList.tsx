import {
  Transaction,
  TransactionIssueReward,
  TransactionPledge,
  TransactionSubscription,
} from '@polar-sh/sdk'
import Link from 'next/link'
import { Avatar } from 'polarkit/components/ui/atoms'
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
  if ('subscription' in transaction && transaction.subscription) {
    return {
      type: 'Subscription',
      organization: transaction.subscription?.subscription_tier.organization,
      meta: transaction.subscription,
    }
  } else if ('pledge' in transaction && transaction.pledge) {
    return {
      type: 'Pledge',
      organization: transaction.pledge?.issue.organization,
      meta: transaction.pledge,
    }
  } else if ('issue_reward' in transaction && transaction.issue_reward) {
    return {
      type: 'Reward',
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
      <td className={twMerge(childClass, 'flex flex-row items-center gap-x-4')}>
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
          {transactionMeta.meta && resolveTransactionMeta(transactionMeta.meta)}
        </div>
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
