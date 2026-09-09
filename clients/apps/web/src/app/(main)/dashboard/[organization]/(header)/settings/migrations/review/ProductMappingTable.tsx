'use client'

import { Button, Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { ProductMappingRow } from './ProductMappingRow'
import {
  formatMappingAmount,
  formatMappingInterval,
  mappingPaginationLabel,
  paginateMappingItems,
  type ProductMappingItem,
} from './productMapping'

const COLUMNS =
  'minmax(0, 7.5rem) max-content max-content max-content minmax(0, 1fr)'

export function ProductMappingTable({
  items,
  saving,
  onChange,
}: {
  items: ProductMappingItem[]
  saving?: boolean
  onChange: (sourceId: string, value: string) => void
}) {
  const [page, setPage] = useState(1)
  const paged = paginateMappingItems(items, page)

  return (
    <Box flexDirection="column" rowGap="s">
      <Grid
        templateColumns={COLUMNS}
        columnGap="m"
        borderWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
        borderRadius="l"
        overflow="hidden"
      >
        <MappingGridRow header>
          <Text variant="caption" color="muted">
            Stripe product
          </Text>
          <Text variant="caption" color="muted">
            Interval
          </Text>
          <Text variant="caption" color="muted">
            Price
          </Text>
          <Text variant="caption" color="muted">
            Subs
          </Text>
          <Text variant="caption" color="muted">
            Polar product
          </Text>
        </MappingGridRow>
        {paged.items.map((item) => (
          <ProductMappingTableRow
            key={item.source_id}
            item={item}
            saving={saving}
            onChange={onChange}
          />
        ))}
      </Grid>
      {paged.showPagination ? (
        <Box alignItems="center" justifyContent="end" columnGap="l">
          <Text variant="caption" color="muted">
            {mappingPaginationLabel(
              paged.rangeStart,
              paged.rangeEnd,
              paged.total,
            )}
          </Text>
          <Box alignItems="center" columnGap="xs">
            <Button
              size="icon"
              variant="outline"
              aria-label="Go to first page"
              disabled={paged.page <= 1}
              onClick={() => setPage(1)}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              aria-label="Go to previous page"
              disabled={paged.page <= 1}
              onClick={() => setPage(paged.page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              aria-label="Go to next page"
              disabled={paged.page >= paged.pageCount}
              onClick={() => setPage(paged.page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              aria-label="Go to last page"
              disabled={paged.page >= paged.pageCount}
              onClick={() => setPage(paged.pageCount)}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </Box>
        </Box>
      ) : null}
    </Box>
  )
}

function MappingGridRow({
  children,
  header = false,
}: {
  children: ReactNode
  header?: boolean
}) {
  return (
    <Box
      display="grid"
      gridTemplateColumns="subgrid"
      gridColumn="1 / -1"
      alignItems="center"
      paddingHorizontal="m"
      paddingVertical="s"
      backgroundColor={header ? 'background-secondary' : undefined}
      borderTopWidth={header ? 0 : 1}
      borderStyle="solid"
      borderColor="border-primary"
    >
      {children}
    </Box>
  )
}

function ProductMappingTableRow({
  item,
  saving,
  onChange,
}: {
  item: ProductMappingItem
  saving?: boolean
  onChange: (sourceId: string, value: string) => void
}) {
  return (
    <MappingGridRow>
      <Box minWidth={0}>
        <Text variant="caption" truncate>
          {item.name}
        </Text>
      </Box>
      <Text variant="caption" color="muted">
        {formatMappingInterval(
          item.recurring_interval,
          item.recurring_interval_count,
        )}
      </Text>
      <Text variant="caption" monospace tabularNums>
        {formatMappingAmount(item.prices)}
      </Text>
      <Text variant="caption" tabularNums>
        {item.subscriber_count}
      </Text>
      <Box minWidth={0} width="100%">
        <ProductMappingRow
          item={item}
          saving={saving}
          onChange={(value) => onChange(item.source_id, value)}
        />
      </Box>
    </MappingGridRow>
  )
}
