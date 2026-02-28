import { useOrganizationAccount, useTransactionsSummary } from '@/hooks/queries'
import { usePayouts } from '@/hooks/queries/payouts'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { formatCurrency } from '@polar-sh/currency'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import { useContext } from 'react'
import { twMerge } from 'tailwind-merge'
import { WidgetContainer } from './WidgetContainer'
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
    <WidgetContainer
      title="Balance"
      action={
        <h2 className="text-lg">
          {formatCurrency('compact')(
            summary?.balance.amount ?? 0,
            summary?.balance.currency ?? 'usd',
          )}
        </h2>
      }
      className={className}
    >
      <div className="flex flex-col gap-y-4"></div>
      <div className="dark:bg-polar-800 flex flex-1 flex-col gap-y-4 rounded-xl bg-gray-50 p-4">
        {lastPayout ? (
          <div className="flex flex-col">
            <div className="flex flex-row items-center justify-between gap-x-2">
              <h3 className="text-lg">
                {formatCurrency('compact')(
                  lastPayout.amount,
                  lastPayout.currency,
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
            <p className="dark:text-polar-600 text-sm text-gray-600">
              {new Date(lastPayout.created_at).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-y-2 text-center">
            <h3>No payouts yet</h3>
            <p className="dark:text-polar-500 text-sm text-gray-500">
              You may only withdraw funds above $10.
            </p>
          </div>
        )}
      </div>
    </WidgetContainer>
  )
}
