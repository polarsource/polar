import { ChevronLeft, ChevronRight } from '@mui/icons-material'
import { useCallback, useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import Button from './Button'

interface PaginatorProps {
  totalCount: number
  currentPage: number
  pageSize: number
  siblingCount?: number
  onPageChange: (page: number) => void
  className?: string
}

const Paginator = ({
  totalCount,
  currentPage,
  pageSize,
  siblingCount = 1,
  onPageChange,
  className,
}: PaginatorProps) => {
  const paginationRange = usePagination({
    totalCount,
    currentPage,
    pageSize,
    siblingCount,
  })

  const onNext = useCallback(() => {
    onPageChange(currentPage + 1)
  }, [onPageChange, currentPage])

  const onPrevious = useCallback(() => {
    onPageChange(currentPage - 1)
  }, [onPageChange, currentPage])

  // If there are less than 2 times in pagination range we shall not render the component
  if (currentPage === 0 || (paginationRange?.length ?? 0) < 2) {
    return null
  }

  const lastPage = paginationRange?.[paginationRange.length - 1]

  return (
    <div
      className={twMerge(
        'flex flex-row items-center justify-center gap-x-2',
        className,
      )}
    >
      <Button
        variant="secondary"
        size="sm"
        onClick={onPrevious}
        disabled={currentPage === 1}
      >
        <ChevronLeft fontSize="small" />
      </Button>
      {paginationRange?.map((pageNumber) => {
        // If the pageItem is a DOT, render the DOTS unicode character
        if (typeof pageNumber === 'symbol') {
          return (
            <div className="dark:text-polar-400 text-gray-400">&#8230;</div>
          )
        }

        // Render our Page Pills
        return (
          <Button
            variant={pageNumber === currentPage ? 'default' : 'secondary'}
            size="sm"
            onClick={() =>
              pageNumber !== currentPage && onPageChange(pageNumber)
            }
          >
            {pageNumber}
          </Button>
        )
      })}
      <Button
        variant="secondary"
        size="sm"
        onClick={onNext}
        disabled={currentPage === lastPage}
      >
        <ChevronRight fontSize="small" />
      </Button>
    </div>
  )
}

export default Paginator

const range = (start: number, end: number) => {
  let length = end - start + 1
  /*
  	Create an array of certain length and set the elements within it from
    start value to end value.
  */
  return Array.from({ length }, (_, idx) => idx + start)
}

const DOTS = Symbol('DOTS')

export const usePagination = ({
  totalCount,
  pageSize,
  siblingCount = 1,
  currentPage,
}: {
  totalCount: number
  pageSize: number
  siblingCount?: number
  currentPage: number
}) => {
  const paginationRange = useMemo(() => {
    const totalPageCount = Math.ceil(totalCount / pageSize)

    // Pages count is determined as siblingCount + firstPage + lastPage + currentPage + 2*DOTS
    const totalPageNumbers = siblingCount + 5

    /*
      Case 1:
      If the number of pages is less than the page numbers we want to show in our
      paginationComponent, we return the range [1..totalPageCount]
    */
    if (totalPageNumbers >= totalPageCount) {
      return range(1, totalPageCount)
    }

    /*
    	Calculate left and right sibling index and make sure they are within range 1 and totalPageCount
    */
    const leftSiblingIndex = Math.max(currentPage - siblingCount, 1)
    const rightSiblingIndex = Math.min(
      currentPage + siblingCount,
      totalPageCount,
    )

    /*
      We do not show dots just when there is just one page number to be inserted between the extremes of sibling and the page limits i.e 1 and totalPageCount. Hence we are using leftSiblingIndex > 2 and rightSiblingIndex < totalPageCount - 2
    */
    const shouldShowLeftDots = leftSiblingIndex > 2
    const shouldShowRightDots = rightSiblingIndex < totalPageCount - 2

    const firstPageIndex = 1
    const lastPageIndex = totalPageCount

    /*
    	Case 2: No left dots to show, but rights dots to be shown
    */
    if (!shouldShowLeftDots && shouldShowRightDots) {
      let leftItemCount = 3 + 2 * siblingCount
      let leftRange = range(1, leftItemCount)

      return [...leftRange, DOTS, totalPageCount]
    }

    /*
    	Case 3: No right dots to show, but left dots to be shown
    */
    if (shouldShowLeftDots && !shouldShowRightDots) {
      let rightItemCount = 3 + 2 * siblingCount
      let rightRange = range(
        totalPageCount - rightItemCount + 1,
        totalPageCount,
      )
      return [firstPageIndex, DOTS, ...rightRange]
    }

    /*
    	Case 4: Both left and right dots to be shown
    */
    if (shouldShowLeftDots && shouldShowRightDots) {
      let middleRange = range(leftSiblingIndex, rightSiblingIndex)
      return [firstPageIndex, DOTS, ...middleRange, DOTS, lastPageIndex]
    }
  }, [totalCount, pageSize, siblingCount, currentPage])

  return paginationRange
}
