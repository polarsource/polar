'use client'

import { FOOTER_HEIGHT } from '@/components/Subscriptions/Gantt/scale'
import { useInViewport } from '@/hooks/utils'
import { Spinner, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { type RowData } from '@tanstack/react-table'
import { type ReactNode, useEffect } from 'react'
import { CondensedTable, type CondensedTableExpansion } from './CondensedTable'
import { CondensedTableHeader } from './CondensedTableHeader'
import { CondensedTableSkeleton } from './CondensedTableSkeleton'
import { type CondensedTableInstance } from './table'

const ignore = () => {}

interface CondensedTableViewProps<T extends RowData> {
  table: CondensedTableInstance<T>
  isLoading: boolean
  emptyLabel: string
  // Rows open a page of their own, so there is no selection to step through.
  onOpen?: (id: string) => void
  // Or they open in place.
  expansion?: CondensedTableExpansion<T>
  renderCompact: (row: T) => ReactNode
  footerLabel?: string
  isLoadingMore: boolean
  onEndReached: () => void
  // Given when the next page failed to load, to ask for it again.
  onRetry?: () => void
}

// A list page's table: the header stays, the rows scroll and load more at the
// end, and a footer says how many there are.
export const CondensedTableView = <T extends RowData>({
  table,
  isLoading,
  emptyLabel,
  onOpen,
  expansion,
  renderCompact,
  footerLabel,
  isLoadingMore,
  onEndReached,
  onRetry,
}: CondensedTableViewProps<T>) => {
  const { ref: endRef, inViewport: isEndVisible } =
    useInViewport<HTMLDivElement>()
  useEffect(() => {
    if (isEndVisible && !isLoadingMore) {
      onEndReached()
    }
  }, [isEndVisible, isLoadingMore, onEndReached])

  return (
    <Box flexDirection="column" flexGrow={1} minHeight={0}>
      <CondensedTableHeader
        table={table}
        inset="l"
        compact
        expandable={expansion !== undefined}
      />
      <Box flexDirection="column" flexGrow={1} minHeight={0} overflowY="auto">
        {isLoading ? (
          <CondensedTableSkeleton table={table} inset="l" compact />
        ) : table.getRowModel().rows.length === 0 ? (
          <Box padding="l">
            <Text color="muted">{emptyLabel}</Text>
          </Box>
        ) : (
          <CondensedTable
            table={table}
            selectedId={null}
            onSelect={onOpen}
            onClose={ignore}
            navigable={false}
            renderCompact={renderCompact}
            inset="l"
            expansion={expansion}
          />
        )}
        <div ref={endRef} />
        {onRetry && !isLoadingMore && (
          <Box alignItems="center" gap="s" padding="l">
            <Text color="muted">Could not load more.</Text>
            <button type="button" className="cursor-pointer" onClick={onRetry}>
              <Text>Try again</Text>
            </button>
          </Box>
        )}
        {isLoadingMore && (
          <Box justifyContent="center" paddingVertical="l">
            <Spinner />
          </Box>
        )}
      </Box>
      <Box
        flexShrink={0}
        height={FOOTER_HEIGHT}
        alignItems="center"
        px="l"
        borderTopWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
      >
        {footerLabel && (
          <Text color="muted" truncate tabularNums>
            {footerLabel}
          </Text>
        )}
      </Box>
    </Box>
  )
}
