'use client'

import { Button, Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useState, type ReactNode } from 'react'
import { ProductMappingRow } from './ProductMappingRow'
import {
  formatMappingAmount,
  formatMappingInterval,
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
        <Box alignItems="center" justifyContent="end" columnGap="s">
          <Text variant="caption" color="muted">
            {paged.rangeStart}–{paged.rangeEnd} of {paged.total}
          </Text>
          <Button
            size="sm"
            variant="secondary"
            disabled={paged.page <= 1}
            onClick={() => setPage(paged.page - 1)}
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={paged.page >= paged.pageCount}
            onClick={() => setPage(paged.page + 1)}
          >
            Next
          </Button>
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
