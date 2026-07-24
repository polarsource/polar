'use client'

import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

export const Pagination = ({
  page,
  totalPages,
  onPageChange,
}: PaginationProps) => (
  <Box alignItems="center" columnGap="s">
    <Text variant="caption" color="muted">
      Page {page} of {totalPages}
    </Text>
    <Box alignItems="center" columnGap="xs">
      <Button
        variant="secondary"
        size="icon"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label="Previous page"
      >
        <ChevronLeft size={12} />
      </Button>
      <Button
        variant="secondary"
        size="icon"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        aria-label="Next page"
      >
        <ChevronRight size={12} />
      </Button>
    </Box>
  </Box>
)
