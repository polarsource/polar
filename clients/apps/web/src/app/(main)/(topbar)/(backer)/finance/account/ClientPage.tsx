'use client'

import AccountsList from '@/components/Accounts/AccountsList'
import { useListAccounts } from '@/hooks/queries'
import { Separator } from '@polar-sh/ui/components/ui/separator'

export default function ClientPage() {
  const { data: accounts } = useListAccounts()

  return (
    <div className="flex flex-col gap-y-6">
      {accounts?.items && accounts.items.length > 0 && (
        <div className="flex flex-col gap-y-8">
          <div className="flex flex-row items-center justify-between">
            <div className="flex flex-col gap-y-2">
              <h2 className="text-lg font-medium">All payout accounts</h2>
              <p className="dark:text-polar-500 text-sm text-gray-500">
                Payout accounts you manage
              </p>
            </div>
          </div>
          <Separator className="my-8" />
          {accounts?.items && (
            <AccountsList
              accounts={accounts?.items}
              returnPath="/finance/account"
            />
          )}
        </div>
      )}
    </div>
  )
}
