import { useOrganizationAccount, useTransactionsSummary } from '@/hooks/queries'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  Card,
  CardFooter,
  CardHeader,
} from '@polar-sh/ui/components/atoms/Card'
import { getCentsInDollarString } from '@polar-sh/ui/lib/money'
import Link from 'next/link'
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
    account?.status === 'active' &&
    summary?.balance?.amount &&
    summary.balance.amount > 0

  return (
    <Card className={twMerge('flex h-80 flex-col justify-between', className)}>
      <CardHeader className="flex flex-col gap-y-1 pb-2">
        <div className="flex flex-row items-center justify-between">
          <span className="dark:text-polar-500 text-gray-400">Finance</span>
        </div>
        <h2 className="text-xl">Account Balance</h2>
      </CardHeader>
      <CardFooter className="dark:bg-polar-900 m-2 flex h-full flex-col items-start justify-end gap-y-4 rounded-3xl bg-white p-4">
        <h2 className="text-3xl">
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
