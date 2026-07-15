'use client'

import AccessRestricted from '@/components/Finance/AccessRestricted'
import TransactionsList from '@/components/Transactions/TransactionsList'
import { useHasPermission } from '@/hooks/permissions'
import { useOrganizationAccount, useSearchTransactions } from '@/hooks/queries'
import {
  DataTablePaginationState,
  DataTableSortingState,
  getAPIParams,
  serializeSearchParams,
} from '@/utils/datatable'
import { ISODuration } from '@/utils/duration'
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

  const canReadFinance = useHasPermission(organization.id, 'finance:read')

  const { data: account, isLoading: accountIsLoading } = useOrganizationAccount(
    canReadFinance ? organization.id : undefined,
  )
  const payoutTransactionDelay = account?.payout_transaction_delay
    ? new ISODuration(account.payout_transaction_delay)
    : null

  const balancesHook = useSearchTransactions({
    account_id: account?.id,
    type: 'balance',
    exclude_platform_fees: true,
    ...getAPIParams(pagination, sorting),
  })
  const balances = balancesHook.data?.items || []
  const rowCount = balancesHook.data?.pagination.total_count ?? 0
  const pageCount = balancesHook.data?.pagination.max_page ?? 1

  if (canReadFinance === false) {
    return (
      <div className="flex flex-col gap-y-6">
        <AccessRestricted message="You don't have permission to view income for this organization. Ask an admin if you need access." />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-y-8">
      <TransactionsList
        transactions={balances}
        rowCount={rowCount}
        pageCount={pageCount}
        pagination={pagination}
        onPaginationChange={setPagination}
        sorting={sorting}
        onSortingChange={setSorting}
        isLoading={accountIsLoading || balancesHook.isLoading}
        payoutTransactionDelay={payoutTransactionDelay}
      />
    </div>
  )
}
