'use client'

import AccountBanner from '@/components/Transactions/AccountBanner'
import TransactionsList from '@/components/Transactions/TransactionsList'
import { useAuth, usePersonalOrganization } from '@/hooks'
import { TransactionType } from '@polar-sh/sdk'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  ShadowBoxOnMd,
  Tabs,
  TabsList,
  TabsTrigger,
} from 'polarkit/components/ui/atoms'
import { TabsContent } from 'polarkit/components/ui/tabs'
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
  const { currentUser } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const personalOrganization = usePersonalOrganization()

  const setActiveTab = useCallback(
    (value: string) => {
      router.replace(`/finance/incoming?type=${value}`)
    },
    [router],
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

  const { data: organizationAccount } = useAccount(
    personalOrganization?.account_id,
  )

  const transfersHook = useSearchTransactions({
    accountId: organizationAccount?.id,
    type: TransactionType.TRANSFER,
    ...getAPIParams(pagination, sorting),
  })
  const transfers = transfersHook.data?.items || []
  const transfersCount = transfersHook.data?.pagination.max_page ?? 1

  const payoutsHooks = useSearchTransactions({
    accountId: organizationAccount?.id,
    type: TransactionType.PAYOUT,
    ...getAPIParams(pagination, sorting),
  })
  const payouts = payoutsHooks.data?.items || []
  const payoutsCount = payoutsHooks.data?.pagination.max_page ?? 1

  return (
    <div className="flex flex-col gap-y-6">
      {personalOrganization && currentUser && (
        <AccountBanner
          organization={personalOrganization}
          user={currentUser}
          isPersonal
        />
      )}
      <ShadowBoxOnMd>
        <Tabs
          defaultValue={params?.get('type') ?? 'transactions'}
          onValueChange={setActiveTab}
        >
          <div className="mb-8 flex flex-col justify-between gap-y-6 md:flex-row md:gap-y-0">
            <div className="flex flex-col gap-y-2">
              <h2 className="text-lg font-medium capitalize">
                {params?.get('type') ?? 'Transactions'}
              </h2>
              <p className="dark:text-polar-500 text-sm text-gray-500">
                {params?.get('type') === 'payouts'
                  ? 'Made from your transfer account to your bank account'
                  : 'Made from Polar to your connected transfer account'}
              </p>
            </div>

            <TabsList className="flex-row dark:border">
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
              <TabsTrigger value="payouts">Payouts</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="transactions">
            <TransactionsList
              transactions={transfers}
              pageCount={transfersCount}
              pagination={pagination}
              onPaginationChange={setPagination}
              sorting={sorting}
              onSortingChange={setSorting}
            />
          </TabsContent>
          <TabsContent value="payouts">
            <TransactionsList
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
