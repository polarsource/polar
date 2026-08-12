'use client'

import { useMemo } from 'react'
import { useDataTableQueryState } from './useDataTableQueryState'

/**
 * Client-side pagination over a fully fetched list, for endpoints that return
 * a bounded ranking rather than paginated results. Pagination state is bound
 * to the URL query string via useDataTableQueryState; call `resetPage` when a
 * filter owned by the page (e.g. the chart range) changes.
 */
export const useClientSidePagination = <T>(
  items: T[],
  defaultPageSize = 20,
) => {
  const { pagination, setPagination, resetPage } = useDataTableQueryState({
    defaultPageSize,
  })

  const pageItems = useMemo(
    () =>
      items.slice(
        pagination.pageIndex * pagination.pageSize,
        (pagination.pageIndex + 1) * pagination.pageSize,
      ),
    [items, pagination],
  )

  return {
    pageItems,
    pagination,
    setPagination,
    resetPage,
    rowCount: items.length,
    pageCount: Math.max(1, Math.ceil(items.length / pagination.pageSize)),
  }
}
