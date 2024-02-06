import {
  OnChangeFn,
  PaginationState,
  SortingState,
} from '@tanstack/react-table'

export type DataTablePaginationState = PaginationState
export type DataTableSortingState = SortingState
export type DataTableOnChangeFn<T> = OnChangeFn<T>
export type DataTableSearchParams = {
  page?: string
  limit?: string
  sorting?: string[] | string
}

const sortingStateToQueryParam = (state: DataTableSortingState): string[] => {
  return state.map(({ id, desc }) => `${desc ? '-' : ''}${id}`)
}

const sortingQueryParamToState = (param: string[]): DataTableSortingState => {
  return param.map((id) => {
    if (id[0] === '-') {
      return { id: id.slice(1), desc: true }
    }
    return { id, desc: false }
  })
}

export const parseSearchParams = (
  searchParams: DataTableSearchParams,
  defaultSorting: DataTableSortingState = [],
  defaultPageSize: number = 20,
): { pagination: DataTablePaginationState; sorting: DataTableSortingState } => {
  const pageIndex = searchParams.page
    ? Number.parseInt(searchParams.page) - 1
    : 0
  const pageSize = searchParams.limit
    ? Number.parseInt(searchParams.limit)
    : defaultPageSize
  const sorting = searchParams.sorting
    ? sortingQueryParamToState(
        Array.isArray(searchParams.sorting)
          ? searchParams.sorting
          : [searchParams.sorting],
      )
    : defaultSorting

  return { pagination: { pageIndex, pageSize }, sorting }
}

export const serializeSearchParams = (
  pagination: DataTablePaginationState,
  sorting: DataTableSortingState,
): URLSearchParams => {
  const searchParams = new URLSearchParams({
    page: (pagination.pageIndex + 1).toString(),
    limit: pagination.pageSize.toString(),
  })
  for (const criteria of sortingStateToQueryParam(sorting)) {
    searchParams.append('sorting', criteria)
  }
  return searchParams
}

export const getAPIParams = (
  pagination: DataTablePaginationState,
  sorting: DataTableSortingState,
): { page: number; limit: number; sorting: string[] } => {
  return {
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    sorting: sortingStateToQueryParam(sorting),
  }
}
