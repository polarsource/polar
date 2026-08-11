'use client'

import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useEffect } from 'react'

export interface BulkActionBarProps {
  count: number
  onClear: () => void
  pageState?: 'none' | 'some' | 'all'
  onPageSelectedChange?: (selected: boolean) => void
  children: React.ReactNode
}

export const BulkActionBar = ({
  count,
  onClear,
  pageState,
  onPageSelectedChange,
  children,
}: BulkActionBarProps) => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClear()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClear])

  return (
    <Box alignItems="center" justifyContent="between" columnGap="l">
      <Box alignItems="center" columnGap="m">
        <Text color="muted">{count} selected</Text>
        {pageState && onPageSelectedChange && (
          <Button
            variant="link"
            onClick={() => onPageSelectedChange(pageState !== 'all')}
          >
            {pageState === 'all' ? 'Deselect all' : 'Select all'}
          </Button>
        )}
        <Button variant="ghost" onClick={onClear}>
          Clear
        </Button>
      </Box>
      <Box alignItems="center" columnGap="s">
        {children}
      </Box>
    </Box>
  )
}
