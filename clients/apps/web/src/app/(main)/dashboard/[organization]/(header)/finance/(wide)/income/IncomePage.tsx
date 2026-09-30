'use client'

import TransactionsList from '@/components/Transactions/TransactionsList'
import { useOrganizationAccount, useSearchTransactions } from '@/hooks/queries'
import { useDataTableQueryState } from '@/hooks/useDataTableQueryState'
import { getAPIParams } from '@/utils/datatable'
import { ISODuration } from '@/utils/duration'
import { schemas } from '@polar-sh/client'

export default function ClientPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const { pagination, setPagination, sorting, setSorting } =
    useDataTableQueryState({
      defaultSorting: [{ id: 'created_at', desc: true }],
      defaultPageSize: 50,
    })

  const { data: account, isLoading: accountIsLoading } = useOrganizationAccount(
    organization.id,
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

  return (
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
  )
}
