'use client'

import {
  DataTablePaginationState,
  DataTableSortingState,
  sortingQueryParamToState,
  sortingStateToQueryParam,
} from '@/utils/datatable'
import { functionalUpdate, OnChangeFn } from '@tanstack/react-table'
import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  useQueryStates,
} from 'nuqs'
import { useCallback, useMemo } from 'react'

interface UseDataTableQueryStateProps {
  defaultSorting?: DataTableSortingState
  defaultPageSize?: number
}

interface DataTableQueryState {
  pagination: DataTablePaginationState
  setPagination: OnChangeFn<DataTablePaginationState>
  sorting: DataTableSortingState
  setSorting: OnChangeFn<DataTableSortingState>
  resetPage: () => void
}

/**
 * Binds a DataTable's pagination and sorting to the URL query string.
 * Filters owned by the page should live in their own `useQueryStates` call and
 * call `resetPage` when they change and nuqs batches both into a single URL
 * update.
 */
export const useDataTableQueryState = ({
  defaultSorting = [],
  defaultPageSize = 20,
}: UseDataTableQueryStateProps = {}): DataTableQueryState => {
  const defaultSortingParam = sortingStateToQueryParam(defaultSorting).join(',')

  const parsers = useMemo(
    () => ({
      page: parseAsInteger.withDefault(1),
      limit: parseAsInteger.withDefault(defaultPageSize),
      sorting: parseAsArrayOf(parseAsString).withDefault(
        defaultSortingParam ? defaultSortingParam.split(',') : [],
      ),
    }),
    [defaultPageSize, defaultSortingParam],
  )

  const [{ page, limit, sorting: sortingParam }, setQueryState] =
    useQueryStates(parsers)

  const pagination = useMemo(
    () => ({ pageIndex: page - 1, pageSize: limit }),
    [page, limit],
  )

  const sorting = useMemo(
    () => sortingQueryParamToState(sortingParam),
    [sortingParam],
  )

  const setPagination = useCallback<OnChangeFn<DataTablePaginationState>>(
    (updater) => {
      const updated = functionalUpdate(updater, pagination)
      setQueryState({ page: updated.pageIndex + 1, limit: updated.pageSize })
    },
    [pagination, setQueryState],
  )

  const setSorting = useCallback<OnChangeFn<DataTableSortingState>>(
    (updater) => {
      const updated = functionalUpdate(updater, sorting)
      setQueryState({ sorting: sortingStateToQueryParam(updated), page: 1 })
    },
    [sorting, setQueryState],
  )

  const resetPage = useCallback(() => {
    setQueryState({ page: 1 })
  }, [setQueryState])

  return { pagination, setPagination, sorting, setSorting, resetPage }
}
