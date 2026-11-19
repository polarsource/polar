import { Text } from '@polar-sh/orbit'
import {
  CondensedTableCell,
  CondensedTableLine,
  type CondensedTableColumn,
  type CondensedTableInset,
} from './columns'

interface CondensedTableHeaderProps<T> {
  columns: CondensedTableColumn<T>[]
  // Hidden on small screens, where the rows use their compact layout.
  compact?: boolean
  inset?: CondensedTableInset
}

export const CondensedTableHeader = <T,>({
  columns,
  compact = false,
  inset = 'm',
}: CondensedTableHeaderProps<T>) => (
  <CondensedTableLine inset={inset} desktopOnly={compact} header>
    {columns.map((column) => (
      <CondensedTableCell key={column.key} column={column}>
        <Text color="muted" wrap="nowrap">
          {column.header}
        </Text>
      </CondensedTableCell>
    ))}
  </CondensedTableLine>
)
