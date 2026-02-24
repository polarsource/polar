'use client'

import AccessRestricted from '@/components/Finance/AccessRestricted'
import AccountBalance from '@/components/Payouts/AccountBalance'
import AccountBanner from '@/components/Transactions/AccountBanner'
import TransactionsList from '@/components/Transactions/TransactionsList'
import { useAuth } from '@/hooks'
import { useOrganizationAccount, useSearchTransactions } from '@/hooks/queries'
import {
  DataTablePaginationState,
  DataTableSortingState,
  getAPIParams,
  serializeSearchParams,
} from '@/utils/datatable'
import { schemas } from '@polar-sh/client'
import { usePathname, useRouter } from 'next/navigation'

export default function ClientPage({
  pagination,
  sorting,
  organization,
}: {
  pagination: DataTablePaginationState
  sorting: DataTableSortingState
  organization: schemas['Organization']
}) {
  const router = useRouter()
  const pathname = usePathname()

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

  const { currentUser } = useAuth()

  const {
    data: account,
    isLoading: accountIsLoading,
  } = useOrganizationAccount(organization.id)

  const isNotAdmin = account ? account.admin_id !== currentUser?.id : false

  const balancesHook = useSearchTransactions({
    account_id: account?.id,
    type: 'balance',
    exclude_platform_fees: true,
    ...getAPIParams(pagination, sorting),
  })
  const balances = balancesHook.data?.items || []
  const rowCount = balancesHook.data?.pagination.total_count ?? 0
  const pageCount = balancesHook.data?.pagination.max_page ?? 1

  if (isNotAdmin) {
    return (
      <div className="flex flex-col gap-y-6">
        <AccessRestricted message="You are not the admin of the account. Only the account admin can view income information." />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-y-8">
      <AccountBanner organization={organization} />
      {account && (
        <AccountBalance
          account={account}
          organization={organization}
          onWithdrawSuccess={() =>
            router.push(`/dashboard/${organization.slug}/finance/payouts`)
          }
        />
      )}
      <TransactionsList
        transactions={balances}
        rowCount={rowCount}
        pageCount={pageCount}
        pagination={pagination}
        onPaginationChange={setPagination}
        sorting={sorting}
        onSortingChange={setSorting}
        isLoading={accountIsLoading || balancesHook.isLoading}
      />
    </div>
  )
}
