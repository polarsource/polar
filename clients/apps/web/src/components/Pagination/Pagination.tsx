import Paginator from '@polar-sh/ui/components/atoms/Paginator'
import { ReadonlyURLSearchParams } from 'next/navigation'
import { PropsWithChildren } from 'react'

interface PaginationProps extends PropsWithChildren {
  totalCount: number
  pageSize: number
  currentPage: number
  siblingCount?: number
  onPageChange: (page: number) => void
  className?: string
  currentURL: ReadonlyURLSearchParams | URLSearchParams
}

const Pagination = ({ children, ...paginatorProps }: PaginationProps) => {
  return (
    <div className="flex flex-col gap-y-12">
      <div className="flex flex-col">{children}</div>
      <Paginator {...paginatorProps} />
    </div>
  )
}

export default Pagination
