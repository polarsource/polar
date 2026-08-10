'use client'

import { ColumnDef } from '@tanstack/react-table'
import { twMerge } from 'tailwind-merge'
import { Checkbox } from '../Checkbox'

export const SELECTION_COLUMN_ID = 'select'
export const SELECTION_COLUMN_WIDTH = 36

export interface DataTableSelection<TData> {
  count: number
  pageState: 'none' | 'some' | 'all'
  isSelected: (item: TData) => boolean
  toggle: (item: TData, options?: { shiftKey?: boolean }) => void
  setPageSelected: (selected: boolean) => void
  /** Human-readable name for a row, used in checkbox accessible labels. */
  getItemLabel?: (item: TData) => string
}

const selectionRevealClassName = (alwaysVisible: boolean) =>
  twMerge(
    'opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 data-[state=checked]:opacity-100 data-[state=indeterminate]:opacity-100 pointer-coarse:opacity-100',
    alwaysVisible && 'opacity-100',
  )

const headerAriaLabel = (count: number) =>
  count > 0
    ? `Select all rows on this page, ${count} selected`
    : 'Select all rows on this page'

const rowAriaLabel = <TData,>(
  selection: DataTableSelection<TData>,
  item: TData,
  rowIndex: number,
) => {
  const label = selection.getItemLabel?.(item)
  return label ? `Select ${label}` : `Select row ${rowIndex + 1}`
}

export const createSelectionColumn = <TData,>(
  selection: DataTableSelection<TData>,
): ColumnDef<TData, unknown> => ({
  id: SELECTION_COLUMN_ID,
  size: SELECTION_COLUMN_WIDTH,
  enableSorting: false,
  header: () => (
    <div
      className="flex h-12 cursor-pointer items-center pl-4"
      onClick={() => selection.setPageSelected(selection.pageState !== 'all')}
    >
      <Checkbox
        aria-label={headerAriaLabel(selection.count)}
        checked={
          selection.pageState === 'some'
            ? 'indeterminate'
            : selection.pageState === 'all'
        }
        className={selectionRevealClassName(selection.count > 0)}
      />
    </div>
  ),
  cell: ({ row }) => (
    <div
      className="flex cursor-pointer items-center py-4 pl-4"
      onClick={(event) => {
        event.stopPropagation()
        selection.toggle(row.original, { shiftKey: event.shiftKey })
      }}
    >
      <Checkbox
        aria-label={rowAriaLabel(selection, row.original, row.index)}
        checked={selection.isSelected(row.original)}
        className={selectionRevealClassName(selection.count > 0)}
      />
    </div>
  ),
})
