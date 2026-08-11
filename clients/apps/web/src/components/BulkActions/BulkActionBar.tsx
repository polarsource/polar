'use client'

import type { SelectionPageState } from '@/hooks/useSelection'
import { Box } from '@polar-sh/orbit/Box'
import { motion } from 'motion/react'
import { BulkSelectionMenu } from './BulkSelectionMenu'
import { useEscapeToClear } from './useEscapeToClear'

export interface BulkActionBarProps {
  count: number
  pageState: SelectionPageState
  pageSelectedCount: number
  pageSize: number
  onPageSelectedChange: (selected: boolean) => void
  onClear: () => void
  children: React.ReactNode
}

// Controls that grow into the page toolbar beside the search field, rather
// than a bar that replaces it. They sit on the page rather than on a surface
// of their own: "1 selected" already states the mode, so a card around it only
// adds a grey slab for the eye to parse.
export const BulkActionBar = ({
  count,
  pageState,
  pageSelectedCount,
  pageSize,
  onPageSelectedChange,
  onClear,
  children,
}: BulkActionBarProps) => {
  useEscapeToClear(onClear, count > 0)

  if (count === 0) {
    return null
  }

  return (
    <motion.div
      style={{ transformOrigin: 'left center' }}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
    >
      <Box
        as="nav"
        aria-label="Bulk actions"
        alignItems="center"
        columnGap="s"
        height={40}
      >
        <BulkSelectionMenu
          count={count}
          pageState={pageState}
          pageSelectedCount={pageSelectedCount}
          pageSize={pageSize}
          onPageSelectedChange={onPageSelectedChange}
          onClear={onClear}
        />
        {children}
      </Box>
    </motion.div>
  )
}
