'use client'

import { DataTablePaginationState } from '@/utils/datatable'
import { functionalUpdate, OnChangeFn } from '@tanstack/react-table'
import { useCallback, useMemo } from 'react'
import { useDataTableQueryState } from './useDataTableQueryState'

/**
 * Client-side pagination over a fully fetched list, for endpoints that return
 * a bounded ranking rather than paginated results. Pagination state is bound
 * to the URL query string via useDataTableQueryState; malformed or
 * out-of-range URL values are clamped to the valid range. Call `resetPage`
 * when a filter owned by the page (e.g. the chart range) changes.
 */
export const useClientSidePagination = <T>(
  items: T[],
  defaultPageSize = 20,
) => {
  const {
    pagination: rawPagination,
    setPagination: setRawPagination,
    resetPage,
  } = useDataTableQueryState({ defaultPageSize })

  const pageSize = Math.max(1, rawPagination.pageSize)
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  const pageIndex = Math.min(
    Math.max(0, rawPagination.pageIndex),
    pageCount - 1,
  )

  const pagination = useMemo(
    () => ({ pageIndex, pageSize }),
    [pageIndex, pageSize],
  )

  const setPagination = useCallback<OnChangeFn<DataTablePaginationState>>(
    (updater) => setRawPagination(functionalUpdate(updater, pagination)),
    [pagination, setRawPagination],
  )

  const pageItems = useMemo(
    () => items.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
    [items, pageIndex, pageSize],
  )

  return {
    pageItems,
    pagination,
    setPagination,
    resetPage,
    rowCount: items.length,
    pageCount,
  }
}
