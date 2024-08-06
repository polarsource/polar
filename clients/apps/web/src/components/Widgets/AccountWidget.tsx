import { useOrganizationAccount, useTransactionsSummary } from '@/hooks/queries'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { Status } from '@polar-sh/sdk'
import { getCentsInDollarString } from '@polarkit/lib/money'
import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'
import { Card, CardFooter, CardHeader } from 'polarkit/components/ui/atoms/card'
import { useContext } from 'react'
import { twMerge } from 'tailwind-merge'

export interface AccountWidgetProps {
  className?: string
}

export const AccountWidget = ({ className }: AccountWidgetProps) => {
  const { organization: org } = useContext(MaintainerOrganizationContext)

  const { data: account } = useOrganizationAccount(org.id)
  const { data: summary } = useTransactionsSummary(account?.id ?? '')

  const canWithdraw =
    account?.status === Status.ACTIVE &&
    summary?.balance?.amount &&
    summary.balance.amount > 0

  return (
    <Card className={twMerge('flex h-80 flex-col justify-between', className)}>
      <CardHeader className="flex flex-col gap-y-2">
        <div className="flex flex-row items-center justify-between">
          <span className="dark:text-polar-500 text-gray-400">Finance</span>
        </div>
        <h2 className="text-xl">Account Balance</h2>
      </CardHeader>
      <CardFooter className="flex flex-col items-start gap-y-4">
        <h2 className="text-2xl">
          ${getCentsInDollarString(summary?.balance.amount ?? 0, false)}
        </h2>
        <Link href={`/dashboard/${org.slug}/finance`}>
          <Button variant={canWithdraw ? 'default' : 'secondary'}>
            {canWithdraw ? 'Withdraw' : 'View Transactions'}
          </Button>
        </Link>
      </CardFooter>
    </Card>
  )
}
