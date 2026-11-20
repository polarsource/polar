import { Box } from '@polar-sh/orbit/Box'
import { type ReactNode } from 'react'
import { type CondensedTableColumnMeta } from './table'

export type CondensedTableInset = 'm' | 'l'

interface CondensedTableCellProps {
  column?: CondensedTableColumnMeta
  children?: ReactNode
}

export const CondensedTableCell = ({
  column: { width, grow = 1, minWidth = 0, align } = {},
  children,
}: CondensedTableCellProps) => (
  <Box
    alignItems="center"
    gap="s"
    justifyContent={align}
    {...(width === undefined
      ? { flexGrow: grow, flexBasis: 0, minWidth }
      : { width, flexShrink: 0 })}
  >
    {children}
  </Box>
)

interface CondensedTableLineProps {
  inset: CondensedTableInset
  // Shown from md up only, when a compact layout covers smaller screens.
  desktopOnly: boolean
  header?: boolean
  minHeight?: number
  children: ReactNode
}

export const CondensedTableLine = ({
  inset,
  desktopOnly,
  header = false,
  minHeight,
  children,
}: CondensedTableLineProps) => (
  <Box
    display={desktopOnly ? { base: 'none', md: 'flex' } : 'flex'}
    alignItems={header ? undefined : 'center'}
    gap="l"
    paddingHorizontal={inset}
    paddingVertical="s"
    minHeight={minHeight}
    borderBottomWidth={1}
    borderStyle="solid"
    borderColor={header ? 'border-primary' : 'border-secondary'}
  >
    {children}
  </Box>
)
