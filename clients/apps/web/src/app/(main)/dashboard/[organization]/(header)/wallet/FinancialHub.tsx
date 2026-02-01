'use client'

import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { type FinancialAccount, mockFinancialAccount } from './treasuryData'

interface FinancialHubProps {
  className?: string
}

export default function FinancialHub({ className }: FinancialHubProps) {
  const [account] = useState<FinancialAccount>(mockFinancialAccount)
  const [isLoading] = useState(false)

  const totalBalance =
    account.balance.available +
    account.balance.inbound_pending -
    account.balance.outbound_pending

  return (
    <div
      className={twMerge(
        'dark:bg-polar-800 flex h-80 flex-col justify-between rounded-4xl bg-gray-50',
        className,
      )}
    >
      <div className="flex flex-col gap-y-4 p-6 pb-2">
        <div className="flex flex-row items-center justify-between">
          <span className="text-lg">Treasury Balance</span>
          <span
            className={twMerge(
              'rounded-full px-2 py-0.5 text-xs',
              account.status === 'open'
                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'
                : 'dark:bg-polar-700 dark:text-polar-400 bg-gray-100 text-gray-500',
            )}
          >
            {account.status === 'open' ? 'Active' : 'Closed'}
          </span>
        </div>
        {isLoading ? (
          <div className="dark:bg-polar-700 h-12 w-48 animate-pulse rounded-lg bg-gray-200" />
        ) : (
          <h2 className="text-5xl font-light">
            {formatCurrencyAndAmount(totalBalance, account.balance.currency, 0)}
          </h2>
        )}
      </div>

      <div className="dark:bg-polar-700 m-2 flex flex-col gap-y-3 rounded-3xl bg-white p-4">
        <div className="flex flex-row items-center justify-between">
          <span className="dark:text-polar-400 text-sm text-gray-500">
            Available
          </span>
          <span className="text-sm">
            {formatCurrencyAndAmount(
              account.balance.available,
              account.balance.currency,
              0,
            )}
          </span>
        </div>
        <div className="flex flex-row items-center justify-between">
          <span className="dark:text-polar-400 text-sm text-gray-500">
            Pending In
          </span>
          <span className="text-sm text-emerald-600 dark:text-emerald-400">
            +
            {formatCurrencyAndAmount(
              account.balance.inbound_pending,
              account.balance.currency,
              0,
            )}
          </span>
        </div>
        <div className="flex flex-row items-center justify-between">
          <span className="dark:text-polar-400 text-sm text-gray-500">
            Pending Out
          </span>
          <span className="dark:text-polar-400 text-sm text-gray-500">
            -
            {formatCurrencyAndAmount(
              account.balance.outbound_pending,
              account.balance.currency,
              0,
            )}
          </span>
        </div>
      </div>
    </div>
  )
}
