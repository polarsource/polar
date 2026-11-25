'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useModal } from '@/components/Modal/useModal'
import { Toolbar } from '@/components/Shared/Toolbar/Toolbar'
import { type ToolbarAction } from '@/components/Shared/Toolbar/ToolbarActionsMenu'
import ExportTransactionsModal from '@/components/Transactions/ExportTransactionsModal'
import { IncomeTable } from '@/components/Transactions/IncomeTable'
import { useOrganizationAccount } from '@/hooks/queries'
import {
  uniqueTransactions,
  useInfiniteTransactions,
} from '@/hooks/queries/transactions'
import { useDataTableQueryState } from '@/hooks/useDataTableQueryState'
import { sortingStateToQueryParam } from '@/utils/datatable'
import { ISODuration } from '@/utils/duration'
import { schemas } from '@polar-sh/client'
import { Alert } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Download } from '@polar-sh/orbit/icons'

const PAGE_SIZE = 50

export default function ClientPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const { sorting, setSorting } = useDataTableQueryState({
    defaultSorting: [{ id: 'created_at', desc: true }],
    defaultPageSize: PAGE_SIZE,
  })

  const { data: account, isLoading: isAccountLoading } = useOrganizationAccount(
    organization.id,
  )
  const payoutTransactionDelay = account?.payout_transaction_delay
    ? new ISODuration(account.payout_transaction_delay)
    : null

  const {
    data,
    isError,
    refetch,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  } = useInfiniteTransactions(account?.id, {
    type: 'balance',
    exclude_platform_fees: true,
    limit: PAGE_SIZE,
    sorting: sortingStateToQueryParam(sorting),
  })

  // An organization without an account has no income to wait for.
  const transactions = data
    ? uniqueTransactions(data.pages)
    : isAccountLoading || account
      ? undefined
      : []
  // Not while the first page is loading, and not again after a page failed,
  // or the visible end of the list would retry it without pause.
  const loadMore = () => {
    if (hasNextPage && !isFetching && !isFetchNextPageError) {
      fetchNextPage()
    }
  }

  const totalCount = data?.pages[0]?.pagination.total_count
  const countLabel =
    totalCount === undefined
      ? undefined
      : `${totalCount.toLocaleString('en-US')} ${totalCount === 1 ? 'entry' : 'entries'}`

  const {
    isShown: isExportModalShown,
    show: showExportModal,
    hide: hideExportModal,
  } = useModal()
  const actions: ToolbarAction[][] = [
    [
      {
        key: 'export',
        label: 'Export CSV',
        icon: <Download />,
        onSelect: showExportModal,
      },
    ],
  ]

  return (
    <DashboardBody
      title={null}
      wrapperClassName="gap-0 pt-0"
      className="min-h-0 flex-1 pb-0"
      wide
      flush
    >
      <Toolbar title="Income" filters={[]} actions={actions} />
      {isError && !data ? (
        <Box padding="l">
          <Alert
            variant="danger"
            title="We couldn't load your income"
            actions={[{ text: 'Try again', onClick: () => refetch() }]}
          />
        </Box>
      ) : (
        <IncomeTable
          organization={organization}
          transactions={transactions}
          payoutTransactionDelay={payoutTransactionDelay}
          sorting={sorting}
          onSortingChange={setSorting}
          footerLabel={countLabel}
          isLoadingMore={isFetchingNextPage}
          onRetry={isFetchNextPageError ? fetchNextPage : undefined}
          onEndReached={loadMore}
        />
      )}
      <ExportTransactionsModal
        organization={organization}
        account={account}
        isShown={isExportModalShown}
        hide={hideExportModal}
      />
    </DashboardBody>
  )
}
