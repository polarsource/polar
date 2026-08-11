'use client'

import { Box } from '@polar-sh/orbit/Box'
import { BulkSelectionMenu } from './BulkSelectionMenu'

export interface BulkActionBarProps {
  count: number
  pageSelectedCount: number
  pageSize: number
  onPageSelectedChange: (selected: boolean) => void
  onClear: () => void
  children: React.ReactNode
}

export const BulkActionBar = ({
  count,
  pageSelectedCount,
  pageSize,
  onPageSelectedChange,
  onClear,
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
