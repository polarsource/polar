import {
  OnChangeFn,
  PaginationState,
  SortingState,
} from '@tanstack/react-table'

export type DataTablePaginationState = PaginationState
export type DataTableSortingState = SortingState
export type DataTableOnChangeFn<T> = OnChangeFn<T>

export const sortingStateToQueryParam = <S extends string>(
  state: DataTableSortingState,
): S[] => {
  return state.map(({ id, desc }) => `${desc ? '-' : ''}${id}` as S)
}

export const sortingQueryParamToState = (
  param: string[],
): DataTableSortingState => {
  return param.map((id) => {
    if (id[0] === '-') {
      return { id: id.slice(1), desc: true }
    }
    return { id, desc: false }
  })
}

export const getAPIParams = <S extends string>(
  pagination: DataTablePaginationState,
  sorting: DataTableSortingState,
): { page: number; limit: number; sorting: S[] } => {
  return {
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    sorting: sortingStateToQueryParam(sorting),
  }
}
