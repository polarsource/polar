import { DownloadOutlined } from '@mui/icons-material'
import { Transaction, TransactionEmbedded } from '@polar-sh/sdk'
import Link from 'next/link'
import { getServerURL } from 'polarkit/api'
import {
  DataTableColumnDef,
  ReactQueryLoading,
} from 'polarkit/components/ui/atoms/datatable'
import {
  DataTableOnChangeFn,
  DataTablePaginationState,
  DataTableSortingState,
} from 'polarkit/datatable'
import TransactionsList, { isTransaction } from './TransactionsList'

interface PayoutTransactionsListProps {
  transactions: Transaction[]
  pageCount: number
  pagination: DataTablePaginationState
  onPaginationChange?: DataTableOnChangeFn<DataTablePaginationState>
  sorting: DataTableSortingState
  onSortingChange?: DataTableOnChangeFn<DataTableSortingState>
  isLoading: boolean | ReactQueryLoading
}

const PayoutTransactionsList = ({
  transactions,
  pageCount,
  pagination,
  onPaginationChange,
  sorting,
  onSortingChange,
  isLoading,
}: PayoutTransactionsListProps) => {
  const extraColumns: DataTableColumnDef<Transaction | TransactionEmbedded>[] =
    [
      {
        id: 'actions',
        accessorKey: 'id',
        enableSorting: false,
        header: () => null,
        cell: (props) => {
          const { row } = props
          const { original: transaction } = row

          if (!isTransaction(transaction)) {
            return null
          }

          const id = props.getValue() as string
          return (
            <div className="flex flex-row justify-end">
              <Link
                href={`${getServerURL()}/api/v1/transactions/payouts/${id}/csv`}
              >
                <DownloadOutlined />
              </Link>
            </div>
          )
        },
      },
    ]

  return (
    <TransactionsList
      transactions={transactions}
      pageCount={pageCount}
      pagination={pagination}
      onPaginationChange={onPaginationChange}
      sorting={sorting}
      onSortingChange={onSortingChange}
      extraColumns={extraColumns}
      isLoading={isLoading}
    />
  )
}

export default PayoutTransactionsList
