'use client'

import Button from '@polar-sh/ui/components/atoms/Button'
import { Building2, CreditCard } from 'lucide-react'
import type { BankAccountInfo } from './ConnectBankAccount'

interface BankAccountCardProps {
  bankAccount: BankAccountInfo
  onDisconnect?: () => void
  showActions?: boolean
}

/**
 * Displays linked bank account information with masked account numbers.
 */
export const BankAccountCard = ({
  bankAccount,
  onDisconnect,
  showActions = true,
}: BankAccountCardProps) => {
  const formatAccountType = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1)
  }

  return (
    <div className="dark:bg-polar-800 dark:border-polar-700 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="dark:bg-polar-700 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
            <Building2 className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </div>
          <div className="flex flex-col">
            <span className="font-medium text-gray-900 dark:text-white">
              {bankAccount.bank_name || 'Bank Account'}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {formatAccountType(bankAccount.account_type)} ••••{' '}
              {bankAccount.account_number_last4}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Routing: •••• {bankAccount.routing_number_last4}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {bankAccount.is_rtp_eligible && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              Instant
            </span>
          )}
          {!bankAccount.is_rtp_eligible && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
              Same-Day
            </span>
          )}
        </div>
      </div>

      {showActions && onDisconnect && (
        <div className="mt-4 flex justify-end border-t border-gray-100 pt-4 dark:border-gray-700">
          <Button
            variant="ghost"
            size="sm"
            onClick={onDisconnect}
            className="text-red-600 hover:text-red-700 dark:text-red-400"
          >
            Disconnect
          </Button>
        </div>
      )}
    </div>
  )
}

export default BankAccountCard
