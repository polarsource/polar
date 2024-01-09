import {
  ReadonlyURLSearchParams,
  useRouter,
  useSearchParams,
} from 'next/navigation'
import { Paginator } from 'polarkit/components/ui/atoms'
import {
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

interface PaginationProps extends PropsWithChildren {
  totalCount: number
  pageSize: number
  currentPage: number
  siblingCount?: number
  onPageChange: (page: number) => void
  className?: string
  currentURL: ReadonlyURLSearchParams
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

export const usePagination = () => {
  const router = useRouter()
  const search = useSearchParams()
  const initialPage = useMemo(() => Number(search?.get('page')) || 1, [search])
  const [currentPage, setCurrentPage] = useState<number>(initialPage)

  useEffect(() => {
    if (!search?.has('page')) {
      setCurrentPage(1)
    }
  }, [search])

  const handleSetCurrentPage = useCallback(
    (page: number) => {
      if (search) {
        setCurrentPage(page)
        const params = new URLSearchParams(search)
        params.set('page', page.toString())

        const url = new URL(window.location.href)
        const newPath = `${url.pathname}?${params.toString()}`
        router.replace(newPath, { scroll: false })
      }
    },
    [router, search],
  )

  return { currentPage, setCurrentPage: handleSetCurrentPage }
}
