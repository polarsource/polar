'use client'

import type { SelectionPageState } from '@/hooks/useSelection'
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/ui/dropdown-menu'

export interface BulkSelectionMenuProps {
  count: number
  pageState: SelectionPageState
  pageSelectedCount: number
  pageSize: number
  onPageSelectedChange: (selected: boolean) => void
  onClear: () => void
  emphasis?: 'solid' | 'plain'
}

// The count is the subject of the whole bar, so it doubles as the control that
// changes the selection's scope. Collapsing "Select all" and "Clear" into one
// menu removes the pair of near-identical text buttons they used to be.
export const BulkSelectionMenu = ({
  count,
  pageState,
  pageSelectedCount,
  pageSize,
  onPageSelectedChange,
  onClear,
  emphasis = 'plain',
}: BulkSelectionMenuProps) => {
  const offPageCount = count - pageSelectedCount

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="focus:outline-none" asChild>
        <Button
          size="sm"
          variant={emphasis === 'solid' ? 'default' : 'ghost'}
          wrapperClassNames="flex flex-row items-center gap-x-1"
        >
          <span role="status" aria-live="polite">
            {count} selected
          </span>
          <ExpandMoreOutlined fontSize="inherit" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="dark:bg-polar-800 bg-gray-50 shadow-lg"
      >
        <DropdownMenuItem
          disabled={pageState === 'all' || pageSize === 0}
          onClick={() => onPageSelectedChange(true)}
        >
          Select all on this page
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={pageSelectedCount === 0}
          onClick={() => onPageSelectedChange(false)}
        >
          Deselect this page
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onClear}>Clear selection</DropdownMenuItem>
        {offPageCount > 0 && (
          <Box paddingHorizontal="s" paddingVertical="xs">
            <Text variant="caption" color="muted">
              {offPageCount} selected on other pages
            </Text>
          </Box>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
