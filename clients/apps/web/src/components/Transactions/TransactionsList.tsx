import Pagination from '../Shared/Pagination'

interface TransactionsListProps {
  transactions: Transaction[]
  totalCount: number
  pageSize: number
  currentPage: number
  onPageChange: (page: number) => void
}

const TransactionsList = ({
  transactions,
  totalCount,
  pageSize,
  currentPage,
  onPageChange,
}: TransactionsListProps) => {
  return (
    <Pagination
      currentPage={currentPage}
      totalCount={totalCount}
      pageSize={pageSize}
      onPageChange={onPageChange}
    ></Pagination>
  )
}

export default TransactionsList
