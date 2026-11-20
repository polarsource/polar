import {
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type OnChangeFn,
  type ReactTable,
  type RowData,
  type SortingState,
} from '@tanstack/react-table'

export interface CondensedTableColumnMeta {
  // A fixed width in pixels. Without one the column shares the free space.
  width?: number
  grow?: number
  minWidth?: number
  align?: 'end'
  // Placeholder bar widths, cycled over the skeleton rows. None leaves it blank.
  skeleton?: number[]
}

const condensedTableFeatures = tableFeatures({
  rowSortingFeature,
  columnMeta: {} as CondensedTableColumnMeta,
})

type CondensedTableFeatures = typeof condensedTableFeatures

// A column with an accessor can be sorted from its header. Its id is the key
// the rows are sorted by.
export type CondensedTableColumn<T extends RowData> = ColumnDef<
  CondensedTableFeatures,
  T,
  unknown
>

export type CondensedTableInstance<T extends RowData> = ReactTable<
  CondensedTableFeatures,
  T
>

interface UseCondensedTableOptions<T extends RowData> {
  columns: CondensedTableColumn<T>[]
  rows: T[]
  getRowId: (row: T) => string
  sorting?: SortingState
  onSortingChange?: OnChangeFn<SortingState>
}

// The rows arrive sorted, so sorting only reports which order is wanted.
export const useCondensedTable = <T extends RowData>({
  columns,
  rows,
  getRowId,
  sorting,
  onSortingChange,
}: UseCondensedTableOptions<T>): CondensedTableInstance<T> =>
  useTable({
    features: condensedTableFeatures,
    columns,
    data: rows,
    getRowId,
    manualSorting: true,
    enableSorting: onSortingChange !== undefined,
    enableSortingRemoval: false,
    onSortingChange,
    ...(sorting ? { state: { sorting } } : {}),
  })
