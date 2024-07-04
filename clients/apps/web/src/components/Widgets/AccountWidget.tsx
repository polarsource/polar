import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import { useAccount, useTransactionsSummary } from '@/hooks/queries'
import { Status } from '@polar-sh/sdk'
import { getCentsInDollarString } from '@polarkit/lib/money'
import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'
import { Card, CardFooter, CardHeader } from 'polarkit/components/ui/atoms/card'
import { twMerge } from 'tailwind-merge'

export interface AccountWidgetProps {
  className?: string
}

export const AccountWidget = ({ className }: AccountWidgetProps) => {
  const { org } = useCurrentOrgAndRepoFromURL()

  const { data: account } = useAccount(org?.account_id)
  const { data: summary } = useTransactionsSummary(account?.id ?? '')

  const canWithdraw =
    account?.status === Status.ACTIVE &&
    summary?.balance?.amount &&
    summary.balance.amount > 0

  return (
    <Card
      className={twMerge(
        'flex h-80 flex-col justify-between ring-1 ring-gray-100 dark:ring-transparent',
        className,
      )}
    >
      <CardHeader className="flex flex-col gap-y-2">
        <div className="flex flex-row items-center justify-between">
          <span className="dark:text-polar-500 text-gray-400">Finance</span>
          <span className="dark:text-polar-500 text-gray-400">
            {new Date().toLocaleDateString('en-US', {
              month: 'long',
              year: 'numeric',
            })}
          </span>
        </div>
        <h2 className="text-xl">Account Balance</h2>
      </CardHeader>
      <CardFooter className="flex flex-col items-start gap-y-4">
        <h2 className="text-2xl">
          ${getCentsInDollarString(summary?.balance.amount ?? 0, false)}
        </h2>
        <Link href={`/maintainer/${org?.name}/finance`}>
          <Button variant={canWithdraw ? 'default' : 'secondary'}>
            {canWithdraw ? 'Withdraw' : 'View Transactions'}
          </Button>
        </Link>
      </CardFooter>
    </Card>
  )
}
