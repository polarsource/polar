import {
  columnSizingFeature,
  columnVisibilityFeature,
  createExpandedRowModel,
  rowExpandingFeature,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
} from '@tanstack/react-table'
import type {
  Cell,
  CellContext,
  Column,
  ColumnDef,
  ReactTable,
  Row,
  RowData,
} from '@tanstack/react-table'

export const dataTableFeatures = tableFeatures({
  columnSizingFeature,
  columnVisibilityFeature,
  rowExpandingFeature,
  expandedRowModel: createExpandedRowModel(),
  rowPaginationFeature,
  rowSortingFeature,
})

export type DataTableFeatures = typeof dataTableFeatures

export type DataTableCell<TData extends RowData, TValue = unknown> = Cell<
  DataTableFeatures,
  TData,
  TValue
>

export type DataTableCellContext<
  TData extends RowData,
  TValue = unknown,
> = CellContext<DataTableFeatures, TData, TValue>

export type DataTableColumn<TData extends RowData, TValue = unknown> = Column<
  DataTableFeatures,
  TData,
  TValue
>

export type DataTableColumnDef<
  TData extends RowData,
  TValue = unknown,
> = ColumnDef<DataTableFeatures, TData, TValue>

export type DataTableInstance<TData extends RowData> = ReactTable<
  DataTableFeatures,
  TData
>

export type DataTableRow<TData extends RowData> = Row<DataTableFeatures, TData>
