'use client'

import { EventTimestamp } from '@/components/Events/EventTimestamp'
import {
  CondensedTableView,
  useCondensedTable,
} from '@/components/Shared/CondensedTable'
import { type DataTableSortingState } from '@/utils/datatable'
import { ISODuration } from '@/utils/duration'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { type OnChangeFn } from '@tanstack/react-table'
import { useState } from 'react'
import {
  formatIncomeNet,
  getIncomeColumns,
  getIncomeLabel,
} from './incomeColumns'
import { IncomeFees } from './IncomeFees'
import { IncomeStatus } from './IncomeStatus'

type Transaction = schemas['Transaction']

const EMPTY: Transaction[] = []

const CompactRow = ({
  transaction,
  payoutTransactionDelay,
}: {
  transaction: Transaction
  payoutTransactionDelay: ISODuration | null
}) => (
  <>
    <Box alignItems="center" justifyContent="between" gap="m">
      <Box minWidth={0}>
        <Text truncate>
          {transaction.order?.product?.name ?? getIncomeLabel(transaction)}
        </Text>
      </Box>
      <Box flexShrink={0}>
        <Text tabularNums>{formatIncomeNet(transaction)}</Text>
      </Box>
    </Box>
    <Box alignItems="center" justifyContent="between" gap="m">
      <EventTimestamp
        timestamp={transaction.created_at}
        format="datetime"
        focusable={false}
        muted
      />
      <IncomeStatus transaction={transaction} delay={payoutTransactionDelay} />
    </Box>
  </>
)

interface IncomeTableProps {
  organization: schemas['Organization']
  transactions: Transaction[] | undefined
  payoutTransactionDelay: ISODuration | null
  sorting: DataTableSortingState
  onSortingChange: OnChangeFn<DataTableSortingState>
  footerLabel?: string
  isLoadingMore: boolean
  onEndReached: () => void
  onRetry?: () => void
}

// Money that reached the account, newest first. An entry opens to the fees
// taken from it.
export const IncomeTable = ({
  organization,
  transactions,
  payoutTransactionDelay,
  sorting,
  onSortingChange,
  footerLabel,
  isLoadingMore,
  onEndReached,
  onRetry,
}: IncomeTableProps) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const table = useCondensedTable({
    columns: getIncomeColumns(organization, payoutTransactionDelay),
    rows: transactions ?? EMPTY,
    getRowId: (transaction) => transaction.id,
    sorting,
    onSortingChange,
  })
  return (
    <CondensedTableView
      table={table}
      isLoading={transactions === undefined}
      emptyLabel="No income yet"
      renderCompact={(transaction) => (
        <CompactRow
          transaction={transaction}
          payoutTransactionDelay={payoutTransactionDelay}
        />
      )}
      expansion={{
        canExpand: (transaction) =>
          transaction.account_incurred_transactions.length > 0,
        isExpanded: (transaction) => expanded[transaction.id] ?? false,
        onToggle: (transaction) =>
          setExpanded((current) => ({
            ...current,
            [transaction.id]: !current[transaction.id],
          })),
        render: (transaction) => (
          <IncomeFees table={table} transaction={transaction} />
        ),
      }}
      footerLabel={footerLabel}
      isLoadingMore={isLoadingMore}
      onEndReached={onEndReached}
      onRetry={onRetry}
    />
  )
}
