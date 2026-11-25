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

// The narrow column before the others in a table whose rows open in place. It
// holds the chevron on a row, and whatever ties a line under it to that row.
export const CondensedTableExpanderCell = ({
  children,
}: {
  children?: ReactNode
}) => (
  <Box
    width={16}
    flexShrink={0}
    alignSelf="stretch"
    alignItems="center"
    justifyContent="center"
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
  // For a row that is open, and the lines under it: the border goes under the
  // last of them.
  borderless?: boolean
  children: ReactNode
}

export const CondensedTableLine = ({
  inset,
  desktopOnly,
  header = false,
  minHeight,
  borderless = false,
  children,
}: CondensedTableLineProps) => (
  <Box
    display={desktopOnly ? { base: 'none', md: 'flex' } : 'flex'}
    alignItems={header ? undefined : 'center'}
    gap="l"
    paddingHorizontal={inset}
    paddingVertical="s"
    minHeight={minHeight}
    borderBottomWidth={borderless ? 0 : 1}
    borderStyle="solid"
    borderColor={header ? 'border-primary' : 'border-secondary'}
  >
    {children}
  </Box>
)
