'use client'

import { Box } from '@polar-sh/orbit/Box'
import { BulkSelectionMenu } from './BulkSelectionMenu'

export interface BulkActionBarProps {
  count: number
  pageSelectedCount: number
  pageSize: number
  onPageSelectedChange: (selected: boolean) => void
  onClear: () => void
  // Stretch the bar to fill its container, pushing the actions to the far end.
  stretch?: boolean
  children: React.ReactNode
}

export const BulkActionBar = ({
  count,
  pageSelectedCount,
  pageSize,
  onPageSelectedChange,
  onClear,
  stretch,
  children,
}: BulkActionBarProps) => {
  if (count === 0) {
    return null
  }

  return (
    <Box
      as="nav"
      aria-label="Bulk actions"
      alignItems="center"
      columnGap="s"
      height={40}
      flexGrow={stretch ? 1 : undefined}
      justifyContent={stretch ? 'between' : undefined}
    >
      <BulkSelectionMenu
        count={count}
        pageSelectedCount={pageSelectedCount}
        pageSize={pageSize}
        onPageSelectedChange={onPageSelectedChange}
        onClear={onClear}
      />
      {children}
    </Box>
  )
}
