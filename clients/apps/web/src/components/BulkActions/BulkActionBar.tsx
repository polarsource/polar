'use client'

import { Box } from '@polar-sh/orbit/Box'
import { motion } from 'motion/react'
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
