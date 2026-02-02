'use client'

import { formatCurrencyAndAmount } from '@spaire/ui/lib/money'
import {
  ArrowDownRight,
  ArrowUpRight,
  CreditCard,
  Clock,
  Building2,
  MoreHorizontal,
} from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import SDSCard, { SDSCardHeader, SDSCardTitle } from './SDSCard'
import SDSButton from './SDSButton'

/**
 * Wallet View Component
 * Displays Financial Account overview following SDS principles
 *
 * Features:
 * - Available Balance
 * - Pending Payouts
 * - Commercial Card Transactions
 * - 8px grid compliant
 */

interface Transaction {
  id: string
  description: string
  amount: number
  currency: string
  type: 'credit' | 'debit'
  category: string
  timestamp: Date
  cardLast4?: string
}

interface WalletViewProps {
  className?: string
  availableBalance: number
  pendingPayouts: number
  currency?: string
  transactions?: Transaction[]
  onAddFunds?: () => void
  onTransfer?: () => void
}

export default function WalletView({
  className,
  availableBalance,
  pendingPayouts,
  currency = 'usd',
  transactions = [],
  onAddFunds,
  onTransfer,
}: WalletViewProps) {
  return (
    <div className={twMerge('flex flex-col gap-6', className)}>
      {/* Balance Overview */}
      <SDSCard padding="lg">
        <div className="flex flex-col gap-8">
          {/* Header */}
          <SDSCardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#EEF2FF] dark:bg-[#312E81]">
                <Building2 className="h-5 w-5 text-[#635BFF]" />
              </div>
              <div>
                <SDSCardTitle size="lg">Financial Account</SDSCardTitle>
                <p className="text-sm text-[#697386] dark:text-[#8892B0] tracking-[-0.01em]">
                  Powered by Spaire Treasury
                </p>
              </div>
            </div>
            <SDSButton variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </SDSButton>
          </SDSCardHeader>

          {/* Balances Grid */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Available Balance */}
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-[#697386] dark:text-[#8892B0] tracking-[-0.01em]">
                Available Balance
              </span>
              <span className="text-4xl font-semibold text-[#0A2540] dark:text-[#E6F1FF] tracking-[-0.02em]">
                {formatCurrencyAndAmount(availableBalance, currency, 0)}
              </span>
            </div>

            {/* Pending Payouts */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[#697386] dark:text-[#8892B0] tracking-[-0.01em]">
                  Pending Payouts
                </span>
                <Clock className="h-3.5 w-3.5 text-[#8792A2] dark:text-[#5C6B8A]" />
              </div>
              <span className="text-4xl font-semibold text-[#425466] dark:text-[#A8B2D1] tracking-[-0.02em]">
                {formatCurrencyAndAmount(pendingPayouts, currency, 0)}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <SDSButton variant="primary" onClick={onAddFunds}>
              Add Funds
            </SDSButton>
            <SDSButton variant="secondary" onClick={onTransfer}>
              Transfer
            </SDSButton>
          </div>
        </div>
      </SDSCard>

      {/* Commercial Card Section */}
      <SDSCard padding="none">
        <div className="p-6 border-b border-[#E3E8EF] dark:border-[#1E3A5F]">
          <SDSCardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F0FDFA] dark:bg-[#134E4A]">
                <CreditCard className="h-5 w-5 text-[#14B8A6]" />
              </div>
              <div>
                <SDSCardTitle>Commercial Card</SDSCardTitle>
                <p className="text-sm text-[#697386] dark:text-[#8892B0] tracking-[-0.01em]">
                  Recent transactions
                </p>
              </div>
            </div>
            <SDSButton variant="link" size="sm">
              View All
            </SDSButton>
          </SDSCardHeader>
        </div>

        {/* Transactions List */}
        <div className="divide-y divide-[#E3E8EF] dark:divide-[#1E3A5F]">
          {transactions.length > 0 ? (
            transactions.slice(0, 5).map((tx) => (
              <TransactionRow key={tx.id} transaction={tx} />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CreditCard className="h-8 w-8 text-[#8792A2] dark:text-[#5C6B8A] mb-3" />
              <p className="text-sm font-medium text-[#425466] dark:text-[#A8B2D1] tracking-[-0.01em]">
                No transactions yet
              </p>
              <p className="text-sm text-[#697386] dark:text-[#8892B0] tracking-[-0.01em] mt-1">
                Card transactions will appear here
              </p>
            </div>
          )}
        </div>
      </SDSCard>
    </div>
  )
}

/**
 * Transaction Row Component
 */
function TransactionRow({ transaction }: { transaction: Transaction }) {
  const isCredit = transaction.type === 'credit'
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(transaction.timestamp)

  return (
    <div className="flex items-center justify-between px-6 py-4 hover:bg-[#F6F9FC] dark:hover:bg-[#1D3A5F] transition-colors">
      <div className="flex items-center gap-4">
        <div
          className={twMerge(
            'flex h-9 w-9 items-center justify-center rounded-full',
            isCredit
              ? 'bg-[#ECFDF5] dark:bg-[#064E3B]'
              : 'bg-[#F6F9FC] dark:bg-[#1D3A5F]'
          )}
        >
          {isCredit ? (
            <ArrowDownRight className="h-4 w-4 text-[#10B981]" />
          ) : (
            <ArrowUpRight className="h-4 w-4 text-[#697386] dark:text-[#8892B0]" />
          )}
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-[#0A2540] dark:text-[#E6F1FF] tracking-[-0.01em]">
            {transaction.description}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#697386] dark:text-[#8892B0]">
              {formattedDate}
            </span>
            {transaction.cardLast4 && (
              <>
                <span className="text-[#D1D9E6] dark:text-[#2D4A6F]">
                  &middot;
                </span>
                <span className="text-xs text-[#697386] dark:text-[#8892B0] font-mono">
                  **** {transaction.cardLast4}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
      <span
        className={twMerge(
          'text-sm font-medium tracking-[-0.01em] tabular-nums',
          isCredit
            ? 'text-[#10B981] dark:text-[#34D399]'
            : 'text-[#0A2540] dark:text-[#E6F1FF]'
        )}
      >
        {isCredit ? '+' : '-'}
        {formatCurrencyAndAmount(Math.abs(transaction.amount), transaction.currency, 0)}
      </span>
    </div>
  )
}

/**
 * Wallet Stats Card Component
 */
interface WalletStatProps {
  label: string
  value: string | number
  change?: {
    value: number
    direction: 'up' | 'down'
  }
  className?: string
}

export function WalletStat({ label, value, change, className }: WalletStatProps) {
  return (
    <SDSCard className={className} padding="md">
      <div className="flex flex-col gap-1">
        <span className="text-sm text-[#697386] dark:text-[#8892B0] tracking-[-0.01em]">
          {label}
        </span>
        <span className="text-2xl font-semibold text-[#0A2540] dark:text-[#E6F1FF] tracking-[-0.02em]">
          {value}
        </span>
        {change && (
          <div className="flex items-center gap-1 mt-1">
            {change.direction === 'up' ? (
              <ArrowUpRight className="h-3.5 w-3.5 text-[#10B981]" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5 text-[#EF4444]" />
            )}
            <span
              className={twMerge(
                'text-xs font-medium',
                change.direction === 'up'
                  ? 'text-[#10B981]'
                  : 'text-[#EF4444]'
              )}
            >
              {change.value}%
            </span>
            <span className="text-xs text-[#8792A2] dark:text-[#5C6B8A]">
              vs last month
            </span>
          </div>
        )}
      </div>
    </SDSCard>
  )
}
