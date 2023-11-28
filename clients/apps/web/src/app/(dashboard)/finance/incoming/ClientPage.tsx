'use client'

import TransactionsList from '@/components/Transactions/TransactionsList'
import { useAuth } from '@/hooks'
import { TransactionType } from '@polar-sh/sdk'
import { useRouter, useSearchParams } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger } from 'polarkit/components/ui/atoms'
import { TabsContent } from 'polarkit/components/ui/tabs'
import {
  useListAccountsByOrganization,
  useListAccountsByUser,
  useListAdminOrganizations,
} from 'polarkit/hooks'
import { useCallback } from 'react'

export default function ClientPage() {
  const router = useRouter()
  const params = useSearchParams()
  const { currentUser } = useAuth()
  const organizations = useListAdminOrganizations()
  const personalOrganization = organizations.data?.items?.find(
    (org) => org.name === currentUser?.username,
  )

  const setActiveTab = useCallback((value: string) => {
    router.replace(`/finance/incoming?type=${value}`)
  }, [])

  const accounts = useListAccountsByUser(currentUser?.id ?? '')
  const organizationAccounts = useListAccountsByOrganization(
    personalOrganization?.id,
  )
  const [account] = accounts.data?.items ?? []
  const [organizationAccount] = organizationAccounts.data?.items ?? []

  return (
    <div className="dark:bg-polar-900 dark:border-polar-800 min-h-[480px] rounded-3xl border border-gray-100 bg-white p-8">
      {organizationAccount && (
        <Tabs
          className="flex flex-col gap-y-4"
          defaultValue={params.get('type') ?? 'transactions'}
          onValueChange={setActiveTab}
        >
          <div className="flex flex-row items-center justify-between">
            <h2 className="text-lg font-medium capitalize">
              {params?.get('type') ?? 'Transactions'}
            </h2>
            <TabsList className="dark:border-polar-700 border border-gray-200">
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
              <TabsTrigger value="payouts">Payouts</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="transactions">
            <TransactionsList
              accountId={organizationAccount.id}
              type={TransactionType.TRANSFER}
              pageSize={20}
            />
          </TabsContent>
          <TabsContent value="payouts">
            <TransactionsList
              accountId={organizationAccount.id}
              type={TransactionType.PAYMENT}
              pageSize={20}
              payoutsOnly
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
