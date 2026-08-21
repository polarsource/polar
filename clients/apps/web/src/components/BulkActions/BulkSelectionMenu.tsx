'use client'

import CloseOutlined from '@mui/icons-material/CloseOutlined'
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
  pageSelectedCount: number
  pageSize: number
  onPageSelectedChange: (selected: boolean) => void
  onClear: () => void
  size?: 'default' | 'sm'
}

export const BulkSelectionMenu = ({
  count,
  pageSelectedCount,
  pageSize,
  onPageSelectedChange,
  onClear,
  size = 'default',
}: BulkSelectionMenuProps) => {
  const offPageCount = count - pageSelectedCount
  const pageFullySelected = pageSize > 0 && pageSelectedCount === pageSize

  return (
    <Box alignItems="center" columnGap="xs">
      <DropdownMenu>
        <DropdownMenuTrigger className="focus:outline-none" asChild>
          <Button
            size={size}
            variant="secondary"
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
            disabled={pageFullySelected || pageSize === 0}
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
      <Button
        size="icon"
        variant="ghost"
        onClick={onClear}
        aria-label="Clear selection"
      >
        <CloseOutlined fontSize="inherit" />
      </Button>
    </Box>
  )
}
