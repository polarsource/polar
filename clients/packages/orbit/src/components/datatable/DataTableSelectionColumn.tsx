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
  size: 32,
  enableSorting: false,
  header: () => (
    <div
      className="-ml-4 flex h-12 w-8 cursor-pointer items-center pl-4"
      onClick={() => selection.setPageSelected(selection.pageState !== 'all')}
    >
      <Checkbox
        aria-label="Select all rows on this page"
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
      className="-my-4 -ml-4 flex cursor-pointer items-center py-4 pl-4"
      onClick={(event) => {
        event.stopPropagation()
        selection.toggle(row.original, { shiftKey: event.shiftKey })
      }}
    >
      <Checkbox
        aria-label="Select row"
        checked={row.getIsSelected()}
        className={selectionRevealClassName(selection.count > 0)}
      />
    </div>
  ),
})
