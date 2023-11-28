'use client'

import TransactionsList from '@/components/Transactions/TransactionsList'
import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import { useRouter, useSearchParams } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger } from 'polarkit/components/ui/atoms'
import { TabsContent } from 'polarkit/components/ui/tabs'
import { useCallback, useMemo } from 'react'

export default function ClientPage() {
  const router = useRouter()
  const { org, isLoaded } = useCurrentOrgAndRepoFromURL()

  const params = useSearchParams()

  const setActiveTab = useCallback((value: string) => {
    router.replace(`/finance/incoming?type=${value}`)
  }, [])

  const currentTabLabel = useMemo(() => {
    const status = params?.get('type') ?? 'transactions'

    switch (status) {
      case 'payouts':
        return 'Payouts'
      case 'transactions':
      default:
        return 'Transactions'
    }
  }, [params])

  return (
    <div className="flex flex-col">
      <Tabs
        defaultValue={params.get('type') ?? 'transactions'}
        onValueChange={setActiveTab}
      >
        <div className="flex flex-row items-center justify-between">
          <h2 className="text-lg font-medium">{currentTabLabel}</h2>
          <TabsList className="dark:border-polar-700 border border-gray-200">
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="payouts">Payouts</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="transactions">
          <TransactionsList />
        </TabsContent>
        <TabsContent value="payouts">
          <TransactionsList />
        </TabsContent>
      </Tabs>
    </div>
  )
}
