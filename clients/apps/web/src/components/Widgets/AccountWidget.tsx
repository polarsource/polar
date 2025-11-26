import { useOrganizationAccount, useTransactionsSummary } from '@/hooks/queries'
import { usePayouts } from '@/hooks/queries/payouts'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
import Link from 'next/link'
import { useContext } from 'react'
import { twMerge } from 'tailwind-merge'
export interface AccountWidgetProps {
  className?: string
}

export const AccountWidget = ({ className }: AccountWidgetProps) => {
  const { organization: org } = useContext(OrganizationContext)

  const { data: account } = useOrganizationAccount(org.id)
  const { data: summary } = useTransactionsSummary(account?.id ?? '')
  const { data: payouts } = usePayouts(account?.id, {
    limit: 1,
    sorting: ['-created_at'],
  })

  const lastPayout = payouts?.items[0]

  const canWithdraw =
    org.status === 'active' &&
    summary?.balance?.amount &&
    summary.balance.amount > 0

  return (
    <div
      className={twMerge(
        'dark:bg-polar-800 flex h-80 flex-col justify-between rounded-4xl bg-gray-50',
        className,
      )}
    >
      <div className="flex flex-col gap-y-4 p-6 pb-2">
        <div className="flex flex-row items-center justify-between">
          <span className="text-lg">Account Balance</span>
          <Link href={`/dashboard/${org.slug}/finance`}>
            <Button
              variant={canWithdraw ? 'default' : 'secondary'}
              size="sm"
              className="rounded-full border-none"
            >
              {canWithdraw ? 'Withdraw' : 'Transactions'}
            </Button>
          </Link>
        </div>
        <h2 className="text-5xl font-light">
          {summary &&
            formatCurrencyAndAmount(
              summary.balance.amount,
              summary.balance.currency,
              0,
            )}
        </h2>
      </div>
      <div className="dark:bg-polar-700 m-2 flex flex-col gap-y-4 rounded-3xl bg-white p-4">
        {lastPayout ? (
          <div className="flex flex-col">
            <div className="flex flex-row items-center justify-between gap-x-2">
              <h3 className="text-lg">
                {formatCurrencyAndAmount(
                  lastPayout.amount,
                  lastPayout.currency,
                  0,
                )}
              </h3>
              <Status
                status={lastPayout.status.split('_').join(' ')}
                className={twMerge(
                  'px-2 py-1 text-sm capitalize',
                  lastPayout.status === 'succeeded'
                    ? 'bg-emerald-50 text-emerald-500 dark:bg-emerald-950'
                    : 'bg-yellow-50 text-yellow-500 dark:bg-yellow-950',
                )}
              />
            </div>
            <p className="dark:text-polar-500 text-sm text-gray-500">
              {new Date(lastPayout.created_at).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            <h3>No payouts yet</h3>
            <p className="dark:text-polar-500 text-sm text-gray-500">
              You may only withdraw funds above $10.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
