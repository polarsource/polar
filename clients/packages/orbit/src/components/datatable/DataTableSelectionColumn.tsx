'use client'

import { ColumnDef } from '@tanstack/react-table'
import { selectionRevealClassName } from '../../lib/selectionReveal'
import { Checkbox } from '../Checkbox'

export interface DataTableSelection<TData> {
  count: number
  pageState: 'none' | 'some' | 'all'
  isSelected: (item: TData) => boolean
  toggle: (item: TData, options?: { shiftKey?: boolean }) => void
  setPageSelected: (selected: boolean) => void
}

export const createSelectionColumn = <TData,>(
  selection: DataTableSelection<TData>,
): ColumnDef<TData, unknown> => ({
  id: 'select',
  size: 44,
  enableSorting: false,
  header: () => (
    <Checkbox
      aria-label="Select all rows on this page"
      checked={
        selection.pageState === 'some'
          ? 'indeterminate'
          : selection.pageState === 'all'
      }
      onCheckedChange={(checked) => selection.setPageSelected(checked === true)}
      className={selectionRevealClassName(selection.count > 0)}
    />
  ),
  cell: ({ row }) => (
    <Checkbox
      aria-label="Select row"
      checked={row.getIsSelected()}
      onClick={(event) => {
        event.stopPropagation()
        selection.toggle(row.original, { shiftKey: event.shiftKey })
      }}
      className={selectionRevealClassName(selection.count > 0)}
    />
  ),
})
