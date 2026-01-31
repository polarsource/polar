'use client'

import { ArrowDownLeft, ArrowUpRight, Clock, Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  type FinancialAccount,
  formatCurrency,
  mockFinancialAccount,
} from './treasuryData'

interface FinancialHubProps {
  className?: string
}

// Skeleton loader for balance
const BalanceSkeleton = () => (
  <div className="animate-pulse">
    <div className="dark:bg-polar-700 mb-2 h-4 w-24 rounded bg-gray-200" />
    <div className="dark:bg-polar-600 h-10 w-40 rounded bg-gray-300" />
  </div>
)

// Balance stat card
const BalanceStat = ({
  label,
  amount,
  currency,
  icon: Icon,
  variant = 'default',
}: {
  label: string
  amount: number
  currency: string
  icon: React.ElementType
  variant?: 'default' | 'pending' | 'incoming'
}) => {
  const variantStyles = {
    default: 'text-gray-900 dark:text-white',
    pending: 'text-amber-600 dark:text-amber-400',
    incoming: 'text-emerald-600 dark:text-emerald-400',
  }

  const iconStyles = {
    default: 'text-gray-400 dark:text-polar-500',
    pending: 'text-amber-500 dark:text-amber-400',
    incoming: 'text-emerald-500 dark:text-emerald-400',
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="dark:text-polar-400 flex items-center gap-1.5 text-xs font-medium text-gray-500">
        <Icon className={`h-3.5 w-3.5 ${iconStyles[variant]}`} />
        {label}
      </div>
      <div className={`text-2xl font-semibold tracking-tight ${variantStyles[variant]}`}>
        {formatCurrency(amount, currency)}
      </div>
    </div>
  )
}

export default function FinancialHub({ className = '' }: FinancialHubProps) {
  const [account, setAccount] = useState<FinancialAccount | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Simulate API fetch with loading state
  useEffect(() => {
    const timer = setTimeout(() => {
      setAccount(mockFinancialAccount)
      setIsLoading(false)
    }, 800)
    return () => clearTimeout(timer)
  }, [])

  const totalBalance = account
    ? account.balance.available +
      account.balance.outbound_pending +
      account.balance.inbound_pending
    : 0

  return (
    <div
      className={`dark:border-polar-700 dark:bg-polar-900 rounded-2xl border border-gray-200 bg-white ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-polar-800">
        <div className="flex items-center gap-3">
          <div className="dark:bg-polar-800 flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
            <Wallet className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Financial Account
            </h2>
            <p className="dark:text-polar-500 text-xs text-gray-500">
              Stripe Treasury
            </p>
          </div>
        </div>
        {account && (
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                account.status === 'open'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'bg-gray-100 text-gray-600 dark:bg-polar-800 dark:text-polar-400'
              }`}
            >
              {account.status === 'open' ? 'Active' : 'Closed'}
            </span>
          </div>
        )}
      </div>

      {/* Main Balance */}
      <div className="px-6 py-6">
        {isLoading ? (
          <BalanceSkeleton />
        ) : (
          <div>
            <p className="dark:text-polar-400 mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
              Total Balance
            </p>
            <p className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
              {formatCurrency(totalBalance, account?.balance.currency || 'usd')}
            </p>
          </div>
        )}
      </div>

      {/* Balance Breakdown */}
      <div className="grid grid-cols-3 gap-4 border-t border-gray-100 px-6 py-5 dark:border-polar-800">
        {isLoading ? (
          <>
            <BalanceSkeleton />
            <BalanceSkeleton />
            <BalanceSkeleton />
          </>
        ) : (
          <>
            <BalanceStat
              label="Available"
              amount={account?.balance.available || 0}
              currency={account?.balance.currency || 'usd'}
              icon={Wallet}
              variant="default"
            />
            <BalanceStat
              label="Outbound Pending"
              amount={account?.balance.outbound_pending || 0}
              currency={account?.balance.currency || 'usd'}
              icon={ArrowUpRight}
              variant="pending"
            />
            <BalanceStat
              label="Inbound Pending"
              amount={account?.balance.inbound_pending || 0}
              currency={account?.balance.currency || 'usd'}
              icon={ArrowDownLeft}
              variant="incoming"
            />
          </>
        )}
      </div>

      {/* Account Details */}
      {account && account.financial_addresses.length > 0 && (
        <div className="dark:bg-polar-800/50 border-t border-gray-100 bg-gray-50/50 px-6 py-4 dark:border-polar-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="dark:text-polar-400 text-xs font-medium text-gray-500">
                Account Details
              </p>
              <p className="mt-1 font-mono text-sm text-gray-900 dark:text-white">
                {account.financial_addresses[0].aba.routing_number} /{' '}
                ****{account.financial_addresses[0].aba.account_number_last4}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="dark:text-polar-500 h-3.5 w-3.5 text-gray-400" />
              <span className="dark:text-polar-400 text-xs text-gray-500">
                ACH / Wire enabled
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
