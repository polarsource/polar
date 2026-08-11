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
}

const selectionRevealClassName = (alwaysVisible: boolean) =>
  twMerge(
    'opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 data-[state=checked]:opacity-100 data-[state=indeterminate]:opacity-100 pointer-coarse:opacity-100',
    alwaysVisible && 'opacity-100',
  )

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
        aria-label={
          selection.count > 0
            ? `Select all rows on this page, ${selection.count} selected`
            : 'Select all rows on this page'
        }
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
        aria-label={`Select row ${row.index + 1}`}
        checked={selection.isSelected(row.original)}
        className={selectionRevealClassName(selection.count > 0)}
      />
    </div>
  ),
})
