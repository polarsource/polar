'use client'

import AccountBalance from '@/components/Transactions/AccountBalance'
import AccountBanner from '@/components/Transactions/AccountBanner'
import PayoutTransactionsList from '@/components/Transactions/PayoutTransactionsList'
import TransactionsList from '@/components/Transactions/TransactionsList'
import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import { TransactionType } from '@polar-sh/sdk'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ShadowBoxOnMd } from 'polarkit/components/ui/atoms/shadowbox'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from 'polarkit/components/ui/atoms/tabs'
import {
  DataTablePaginationState,
  DataTableSortingState,
  getAPIParams,
  serializeSearchParams,
} from 'polarkit/datatable'
import { useAccount, useSearchTransactions } from 'polarkit/hooks'
import { useCallback } from 'react'

export default function ClientPage({
  pagination,
  sorting,
}: {
  pagination: DataTablePaginationState
  sorting: DataTableSortingState
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const { org } = useCurrentOrgAndRepoFromURL()

  const setActiveTab = useCallback(
    (value: string) => {
      router.replace(`/maintainer/${org?.name}/finance/incoming?type=${value}`)
    },
    [org, router],
  )

  const setPagination = (
    updaterOrValue:
      | DataTablePaginationState
      | ((old: DataTablePaginationState) => DataTablePaginationState),
  ) => {
    const updatedPagination =
      typeof updaterOrValue === 'function'
        ? updaterOrValue(pagination)
        : updaterOrValue

    router.push(
      `${pathname}?${serializeSearchParams(updatedPagination, sorting)}`,
    )
  }

  const setSorting = (
    updaterOrValue:
      | DataTableSortingState
      | ((old: DataTableSortingState) => DataTableSortingState),
  ) => {
    const updatedSorting =
      typeof updaterOrValue === 'function'
        ? updaterOrValue(sorting)
        : updaterOrValue

    router.push(
      `${pathname}?${serializeSearchParams(pagination, updatedSorting)}`,
    )
  }

  const { data: organizationAccount } = useAccount(org?.account_id)

  const balancesHook = useSearchTransactions({
    accountId: organizationAccount?.id,
    type: TransactionType.BALANCE,
    excludePlatformFees: true,
    ...getAPIParams(pagination, sorting),
  })
  const balances = balancesHook.data?.items || []
  const balancesCount = balancesHook.data?.pagination.max_page ?? 1

  const payoutsHooks = useSearchTransactions({
    accountId: organizationAccount?.id,
    type: TransactionType.PAYOUT,
    ...getAPIParams(pagination, sorting),
  })
  const refetchPayouts = payoutsHooks.refetch
  const payouts = payoutsHooks.data?.items || []
  const payoutsCount = payoutsHooks.data?.pagination.max_page ?? 1

  const onWithdrawSuccess = useCallback(async () => {
    await refetchPayouts()
  }, [refetchPayouts])

  return (
    <div className="flex flex-col gap-y-6">
      {org && <AccountBanner organization={org} />}
      {organizationAccount && (
        <AccountBalance
          account={organizationAccount}
          onWithdrawSuccess={onWithdrawSuccess}
        />
      )}
      <ShadowBoxOnMd>
        <Tabs
          defaultValue={params?.get('type') ?? 'transactions'}
          onValueChange={setActiveTab}
        >
          <div className="mb-8 flex flex-col gap-y-6 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-y-2">
              <h2 className="text-lg font-medium capitalize">
                {params?.get('type') ?? 'Transactions'}
              </h2>
              <p className="dark:text-polar-500 text-sm text-gray-500">
                {params?.get('type') === 'payouts'
                  ? 'Made from your account to your bank account'
                  : 'Made from Polar to your account'}
              </p>
            </div>

            <TabsList>
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
              <TabsTrigger value="payouts">Payouts</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="transactions">
            <TransactionsList
              transactions={balances}
              pageCount={balancesCount}
              pagination={pagination}
              onPaginationChange={setPagination}
              sorting={sorting}
              onSortingChange={setSorting}
            />
          </TabsContent>
          <TabsContent value="payouts">
            <PayoutTransactionsList
              transactions={payouts}
              pageCount={payoutsCount}
              pagination={pagination}
              onPaginationChange={setPagination}
              sorting={sorting}
              onSortingChange={setSorting}
            />
          </TabsContent>
        </Tabs>
      </ShadowBoxOnMd>
    </div>
  )
}
