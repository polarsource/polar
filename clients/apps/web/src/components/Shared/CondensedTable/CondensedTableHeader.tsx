import { Text } from '@polar-sh/orbit'
import { MoveDown, MoveUp } from '@polar-sh/orbit/icons'
import { flexRender, type RowData } from '@tanstack/react-table'
import {
  CondensedTableCell,
  CondensedTableExpanderCell,
  CondensedTableLine,
  type CondensedTableInset,
} from './columns'
import { type CondensedTableInstance } from './table'

const SORT_BUTTON_CLASS =
  'group flex min-w-0 cursor-pointer items-center gap-1 data-[align=end]:flex-row-reverse'
const SORT_ICON_CLASS =
  'dark:text-polar-500 size-3 shrink-0 text-gray-500 opacity-0 transition-opacity duration-[120ms] group-hover:opacity-100 data-[active=true]:opacity-100 data-[active=true]:text-gray-950 dark:data-[active=true]:text-white'

interface CondensedTableHeaderProps<T extends RowData> {
  table: CondensedTableInstance<T>
  // Hidden on small screens, where the rows use their compact layout.
  compact?: boolean
  inset?: CondensedTableInset
  // Leaves room for the chevron of a table whose rows open in place.
  expandable?: boolean
}

export const CondensedTableHeader = <T extends RowData>({
  table,
  compact = false,
  inset = 'm',
  expandable = false,
}: CondensedTableHeaderProps<T>) => (
  <CondensedTableLine inset={inset} desktopOnly={compact} header>
    {expandable && <CondensedTableExpanderCell />}
    {table.getFlatHeaders().map((header) => {
      const { column } = header
      const meta = column.columnDef.meta
      const sorted = column.getIsSorted()
      // Without a sort, the arrow previews the order a click gives.
      const Icon =
        (sorted || column.getNextSortingOrder()) === 'desc' ? MoveDown : MoveUp
      const label = (
        <Text color={sorted ? undefined : 'muted'} truncate>
          {flexRender(column.columnDef.header, header.getContext())}
        </Text>
      )
      return (
        <CondensedTableCell key={header.id} column={meta}>
          {column.getCanSort() ? (
            <button
              type="button"
              className={SORT_BUTTON_CLASS}
              data-align={meta?.align}
              aria-sort={
                sorted === 'asc'
                  ? 'ascending'
                  : sorted === 'desc'
                    ? 'descending'
                    : undefined
              }
              onClick={() => column.toggleSorting()}
            >
              {label}
              <Icon
                className={SORT_ICON_CLASS}
                data-active={sorted !== false}
              />
            </button>
          ) : (
            label
          )}
        </CondensedTableCell>
      )
    })}
  </CondensedTableLine>
)
