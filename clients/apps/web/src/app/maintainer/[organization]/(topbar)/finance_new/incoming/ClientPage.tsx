'use client'

import Pagination, { usePagination } from '@/components/Shared/Pagination'
import AccountBanner from '@/components/Transactions/AccountBanner'
import TransactionsList from '@/components/Transactions/TransactionsList'
import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ShadowBoxOnMd,
  Tabs,
  TabsList,
  TabsTrigger,
} from 'polarkit/components/ui/atoms'
import { Separator } from 'polarkit/components/ui/separator'
import { TabsContent } from 'polarkit/components/ui/tabs'
import {
  useAccount,
  usePayoutTransactions,
  useTransferTransactions,
} from 'polarkit/hooks'
import { useCallback } from 'react'

export default function ClientPage() {
  const router = useRouter()
  const params = useSearchParams()
  const { currentPage, setCurrentPage } = usePagination()
  const { org } = useCurrentOrgAndRepoFromURL()

  const setActiveTab = useCallback(
    (value: string) => {
      router.replace(
        `/maintainer/${org?.name}/finance_new/incoming?type=${value}`,
      )
    },
    [org],
  )

  console.log('accid', org?.account_id)
  const { data: organizationAccount } = useAccount(org?.account_id)

  const transfers = useTransferTransactions({
    accountId: organizationAccount?.id,
    page: currentPage,
    limit: 20,
  })

  const payouts = usePayoutTransactions({
    accountId: organizationAccount?.id,
    page: currentPage,
    limit: 20,
  })

  return (
    <div className="flex flex-col gap-y-6">
      {org && <AccountBanner organization={org} />}
      <ShadowBoxOnMd>
        <Tabs
          defaultValue={params.get('type') ?? 'transactions'}
          onValueChange={setActiveTab}
        >
          <div className="flex flex-col gap-y-6 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-y-2">
              <h2 className="text-lg font-medium capitalize">
                {params?.get('type') ?? 'Transactions'}
              </h2>
              <p className="dark:text-polar-500 text-sm text-gray-500">
                {params.get('type') === 'payouts'
                  ? 'Made from your transfer account to your bank account'
                  : 'Made from Polar to your connected transfer account'}
              </p>
            </div>

            <TabsList className="dark:border-polar-700 flex-row dark:border">
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
              <TabsTrigger value="payouts">Payouts</TabsTrigger>
            </TabsList>
          </div>
          <Separator className="my-8" />
          <TabsContent value="transactions">
            <Pagination
              currentPage={currentPage}
              totalCount={transfers.data?.pagination.total_count ?? 0}
              pageSize={20}
              onPageChange={setCurrentPage}
            >
              <TransactionsList transactions={transfers.data?.items ?? []} />
            </Pagination>
          </TabsContent>
          <TabsContent value="payouts">
            <Pagination
              currentPage={currentPage}
              totalCount={transfers.data?.pagination.total_count ?? 0}
              pageSize={20}
              onPageChange={setCurrentPage}
            >
              <TransactionsList transactions={payouts.data?.items ?? []} />
            </Pagination>
          </TabsContent>
        </Tabs>
      </ShadowBoxOnMd>
    </div>
  )
}
