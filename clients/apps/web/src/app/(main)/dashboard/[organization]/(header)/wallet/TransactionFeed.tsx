'use client'

import {
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  MoreHorizontal,
  Receipt,
} from 'lucide-react'
import { useState } from 'react'
import {
  formatCurrency,
  getRelativeTime,
  mockTransactions,
  type Transaction,
} from './treasuryData'

interface TransactionFeedProps {
  className?: string
}

// Transaction type icon mapping
const TransactionIcon = ({ flowType }: { flowType: Transaction['flow_type'] }) => {
  const iconMap = {
    inbound_transfer: ArrowDownLeft,
    received_credit: ArrowDownLeft,
    outbound_transfer: ArrowUpRight,
    outbound_payment: ArrowUpRight,
    received_debit: ArrowUpRight,
    issuing_authorization: CreditCard,
  }

  const colorMap = {
    inbound_transfer: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
    received_credit: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
    outbound_transfer: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    outbound_payment: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    received_debit: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    issuing_authorization: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  }

  const Icon = iconMap[flowType] || Receipt
  const colorClass = colorMap[flowType] || 'bg-gray-100 text-gray-600 dark:bg-polar-700 dark:text-polar-400'

  return (
    <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${colorClass}`}>
      <Icon className="h-4 w-4" />
    </div>
  )
}

// Single transaction row
const TransactionRow = ({ transaction }: { transaction: Transaction }) => {
  const isCredit = transaction.amount > 0
  const merchantName = transaction.flow_details?.issuing_authorization?.merchant_name

  // Get display name
  const getDisplayName = () => {
    if (merchantName) return merchantName
    return transaction.description
  }

  // Get flow type label
  const getFlowLabel = () => {
    switch (transaction.flow_type) {
      case 'inbound_transfer':
        return 'Inbound Transfer'
      case 'received_credit':
        return 'Received Credit'
      case 'outbound_transfer':
        return 'Outbound Transfer'
      case 'outbound_payment':
        return 'Outbound Payment'
      case 'received_debit':
        return 'Debit'
      case 'issuing_authorization':
        return 'Card Payment'
      default:
        return 'Transaction'
    }
  }

  return (
    <div className="group flex items-center justify-between py-3 transition-colors hover:bg-gray-50 dark:hover:bg-polar-800/50">
      <div className="flex items-center gap-3">
        <TransactionIcon flowType={transaction.flow_type} />
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {getDisplayName()}
          </p>
          <p className="dark:text-polar-500 text-xs text-gray-500">
            {getFlowLabel()} · {getRelativeTime(transaction.created)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <p
          className={`text-sm font-semibold tabular-nums ${
            isCredit
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-gray-900 dark:text-white'
          }`}
        >
          {isCredit ? '+' : ''}
          {formatCurrency(transaction.amount, transaction.currency)}
        </p>
        <button className="opacity-0 transition-opacity group-hover:opacity-100">
          <MoreHorizontal className="dark:text-polar-500 h-4 w-4 text-gray-400" />
        </button>
      </div>
    </div>
  )
}

// Skeleton loader for transactions
const TransactionSkeleton = () => (
  <div className="flex animate-pulse items-center justify-between py-3">
    <div className="flex items-center gap-3">
      <div className="dark:bg-polar-700 h-9 w-9 rounded-xl bg-gray-200" />
      <div className="space-y-2">
        <div className="dark:bg-polar-600 h-4 w-32 rounded bg-gray-200" />
        <div className="dark:bg-polar-700 h-3 w-24 rounded bg-gray-100" />
      </div>
    </div>
    <div className="dark:bg-polar-600 h-4 w-20 rounded bg-gray-200" />
  </div>
)

export default function TransactionFeed({ className = '' }: TransactionFeedProps) {
  const [transactions] = useState<Transaction[]>(mockTransactions)
  const [isLoading] = useState(false)

  return (
    <div
      className={`dark:border-polar-700 dark:bg-polar-900 rounded-2xl border border-gray-200 bg-white ${className}`}
    >
      {/* Header */}
      <div className="dark:border-polar-800 flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="dark:bg-polar-800 flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
            <Receipt className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Recent Activity
            </h2>
            <p className="dark:text-polar-500 text-xs text-gray-500">
              Last 7 days
            </p>
          </div>
        </div>
        <button className="dark:text-polar-400 dark:hover:text-polar-200 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900">
          View All
        </button>
      </div>

      {/* Transactions List */}
      <div className="divide-y divide-gray-100 px-6 dark:divide-polar-800">
        {isLoading ? (
          <>
            <TransactionSkeleton />
            <TransactionSkeleton />
            <TransactionSkeleton />
            <TransactionSkeleton />
          </>
        ) : transactions.length === 0 ? (
          <div className="py-12 text-center">
            <Receipt className="mx-auto h-8 w-8 text-gray-300 dark:text-polar-600" />
            <p className="dark:text-polar-400 mt-3 text-sm text-gray-500">
              No transactions yet
            </p>
          </div>
        ) : (
          transactions.map((transaction) => (
            <TransactionRow key={transaction.id} transaction={transaction} />
          ))
        )}
      </div>

      {/* Summary Footer */}
      {transactions.length > 0 && (
        <div className="dark:border-polar-800 dark:bg-polar-800/50 border-t border-gray-100 bg-gray-50/50 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="dark:text-polar-400 text-xs font-medium text-gray-500">
                Period Summary
              </p>
              <div className="mt-1 flex items-center gap-4">
                <span className="text-sm text-emerald-600 dark:text-emerald-400">
                  +{formatCurrency(4375000, 'usd')} in
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {formatCurrency(-316400, 'usd')} out
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="dark:text-polar-400 text-xs font-medium text-gray-500">
                Net Change
              </p>
              <p className="mt-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                +{formatCurrency(4058600, 'usd')}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
