import { useOrganizationAccount, useTransactionsSummary } from '@/hooks/queries'
import { usePayouts } from '@/hooks/queries/payouts'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { formatCurrency } from '@polar-sh/currency'
import { Card } from '@polar-sh/ui/components/atoms/Card'
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
    limit: 10,
    sorting: ['-created_at'],
  })

  const allPayouts = payouts?.items ?? []

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
      {allPayouts.length > 0 ? (
        <div className="flex flex-col gap-y-2 pb-6">
          {allPayouts.map((payout, i) => (
            <Card
              key={i}
              className="dark:bg-polar-800 flex flex-col gap-y-1 rounded-xl border-none bg-gray-50 px-4 py-4"
            >
              <div className="dark:text-polar-400 flex flex-row items-baseline justify-between text-sm text-gray-700">
                <span>
                  {new Date(payout.created_at).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
                <Status
                  status={payout.status.split('_').join(' ')}
                  className={twMerge(
                    'px-1.5 py-0.5 text-xs capitalize',
                    payout.status === 'succeeded'
                      ? 'bg-emerald-50 text-emerald-500 dark:bg-emerald-950'
                      : 'bg-yellow-50 text-yellow-500 dark:bg-yellow-950',
                  )}
                />
              </div>
              <div className="flex flex-row justify-between gap-x-4">
                <h3>Payout</h3>
                <span>
                  {formatCurrency('compact')(payout.amount, payout.currency)}
                </span>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="mb-6 flex flex-1 flex-col items-center justify-center gap-y-2 rounded-lg bg-gray-50 text-center dark:bg-polar-800">
          <h3>No payouts yet</h3>
          <p className="dark:text-polar-500 text-sm text-gray-500">
            You may only withdraw funds above $10.
          </p>
        </div>
      )}
    </WidgetContainer>
  )
}
