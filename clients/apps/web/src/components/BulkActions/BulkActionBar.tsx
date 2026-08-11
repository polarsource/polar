'use client'

import type { SelectionPageState } from '@/hooks/useSelection'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import { Button } from '@polar-sh/orbit'
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

// A cluster that grows into the page toolbar beside the search field, rather
// than a bar that replaces it. Nothing is removed while rows are selected and
// the toolbar keeps its shape.
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
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
    >
      <Box
        as="nav"
        aria-label="Bulk actions"
        alignItems="center"
        columnGap="xs"
        padding="xs"
        borderRadius="full"
        backgroundColor="background-card"
        borderWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
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
        <Button
          size="icon"
          variant="ghost"
          aria-label="Clear selection"
          onClick={onClear}
        >
          <CloseOutlined fontSize="small" />
        </Button>
      </Box>
    </motion.div>
  )
}
