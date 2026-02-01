'use client'

import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
import Button from '@polar-sh/ui/components/atoms/Button'
import { ArrowDownLeft, ArrowUpRight, CreditCard, Receipt } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { getRelativeTime, mockTransactions, type Transaction } from './treasuryData'

interface TransactionFeedProps {
  className?: string
}

const TransactionIcon = ({
  flowType,
}: {
  flowType: Transaction['flow_type']
}) => {
  const iconMap = {
    inbound_transfer: ArrowDownLeft,
    received_credit: ArrowDownLeft,
    outbound_transfer: ArrowUpRight,
    outbound_payment: ArrowUpRight,
    received_debit: ArrowUpRight,
    issuing_authorization: CreditCard,
  }

  const colorMap: Record<string, string> = {
    inbound_transfer: 'text-emerald-500 dark:text-emerald-400',
    received_credit: 'text-emerald-500 dark:text-emerald-400',
    outbound_transfer: 'dark:text-polar-400 text-gray-500',
    outbound_payment: 'dark:text-polar-400 text-gray-500',
    received_debit: 'dark:text-polar-400 text-gray-500',
    issuing_authorization: 'text-blue-500 dark:text-blue-400',
  }

  const Icon = iconMap[flowType] || Receipt
  const colorClass = colorMap[flowType] || 'dark:text-polar-400 text-gray-500'

  return <Icon className={twMerge('h-4 w-4', colorClass)} />
}

const TransactionRow = ({ transaction }: { transaction: Transaction }) => {
  const isCredit = transaction.amount > 0
  const merchantName =
    transaction.flow_details?.issuing_authorization?.merchant_name

  const getDisplayName = () => {
    if (merchantName) return merchantName
    return transaction.description
  }

  const getFlowLabel = () => {
    switch (transaction.flow_type) {
      case 'inbound_transfer':
        return 'Inbound'
      case 'received_credit':
        return 'Credit'
      case 'outbound_transfer':
        return 'Transfer'
      case 'outbound_payment':
        return 'Payment'
      case 'received_debit':
        return 'Debit'
      case 'issuing_authorization':
        return 'Card'
      default:
        return 'Transaction'
    }
  }

  return (
    <div className="flex items-center justify-between py-2.5">
      <div className="flex items-center gap-3">
        <TransactionIcon flowType={transaction.flow_type} />
        <div>
          <p className="text-sm">{getDisplayName()}</p>
          <p className="dark:text-polar-500 text-xs text-gray-400">
            {getFlowLabel()} · {getRelativeTime(transaction.created)}
          </p>
        </div>
      </div>
      <p
        className={twMerge(
          'text-sm tabular-nums',
          isCredit
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'dark:text-polar-300',
        )}
      >
        {isCredit ? '+' : ''}
        {formatCurrencyAndAmount(
          Math.abs(transaction.amount),
          transaction.currency,
          0,
        )}
      </p>
    </div>
  )
}

export default function TransactionFeed({ className }: TransactionFeedProps) {
  const { organization } = useParams<{ organization: string }>()
  const [transactions] = useState<Transaction[]>(mockTransactions.slice(0, 5))

  return (
    <div
      className={twMerge(
        'dark:bg-polar-800 flex flex-col rounded-4xl bg-gray-50',
        className,
      )}
    >
      <div className="flex flex-col gap-y-4 p-6 pb-2">
        <div className="flex flex-row items-center justify-between">
          <span className="text-lg">Recent Activity</span>
          <Link href={`/dashboard/${organization}/finance`}>
            <Button
              variant="secondary"
              size="sm"
              className="rounded-full border-none"
            >
              View All
            </Button>
          </Link>
        </div>
      </div>

      <div className="dark:bg-polar-700 m-2 flex flex-col rounded-3xl bg-white p-4">
        {transactions.length === 0 ? (
          <div className="py-8 text-center">
            <Receipt className="dark:text-polar-600 mx-auto h-6 w-6 text-gray-300" />
            <p className="dark:text-polar-400 mt-2 text-sm text-gray-500">
              No transactions yet
            </p>
          </div>
        ) : (
          <div className="dark:divide-polar-600 divide-y divide-gray-100">
            {transactions.map((transaction) => (
              <TransactionRow key={transaction.id} transaction={transaction} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
