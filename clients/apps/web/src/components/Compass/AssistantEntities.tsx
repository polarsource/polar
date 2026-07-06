'use client'

import {
  AssistantBlock,
  DataTableColumn,
  DataTableRow,
} from '@/hooks/useCompassAssistant'
import { Avatar, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  DataTable,
  DataTableColumnDef,
  List,
  ListItem,
} from '@polar-sh/orbit'
import { useMemo } from 'react'

const formatCell = (
  value: string | number | null | undefined,
  format: DataTableColumn['format'],
): string => {
  if (value === null || value === undefined) return '—'
  if (format === 'currency' && typeof value === 'number') {
    return `$${(value / 100).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }
  if (format === 'datetime') {
    return new Date(value).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }
  return String(value)
}

export const EntityListView = ({
  block,
}: {
  block: Extract<AssistantBlock, { type: 'entity_list' }>
}) => (
  <List size="small">
    {block.items.map((item, i) => (
      <ListItem key={i} size="small">
        <Box
          width="100%"
          display="flex"
          flexDirection="row"
          alignItems="center"
          justifyContent="between"
          columnGap="l"
        >
          <Box display="flex" flexDirection="column">
            <Text>{item.title}</Text>
            {item.description ? (
              <Text variant="caption" color="muted">
                {item.description}
              </Text>
            ) : null}
          </Box>
          {item.meta ? <Text color="muted">{item.meta}</Text> : null}
        </Box>
      </ListItem>
    ))}
  </List>
)

export const CustomerCardView = ({
  block,
}: {
  block: Extract<AssistantBlock, { type: 'customer_card' }>
}) => (
  <Box
    display="flex"
    flexDirection="row"
    alignItems="center"
    columnGap="l"
    padding="l"
    borderRadius="l"
    borderWidth={1}
    borderStyle="solid"
    borderColor="border-primary"
    backgroundColor="background-card"
  >
    <Avatar name={block.name ?? block.email} avatar_url={null} />
    <Box display="flex" flexDirection="column">
      <Text>{block.name ?? block.email}</Text>
      <Text variant="caption" color="muted">
        {block.email} · Customer since{' '}
        {new Date(block.created_at).toLocaleDateString('en-US', {
          month: 'short',
          year: 'numeric',
        })}
      </Text>
    </Box>
  </Box>
)

export const EntityTableView = ({
  block,
}: {
  block: Extract<AssistantBlock, { type: 'data_table' }>
}) => {
  const columns = useMemo(
    (): DataTableColumnDef<DataTableRow>[] =>
      block.columns.map((column) => ({
        accessorKey: column.key,
        header: column.label,
        cell: ({ row }) => {
          const value = row.original[column.key]
          if (column.format === 'badge' && value !== null) {
            return <Status status={String(value)} size="small" />
          }
          return <Text>{formatCell(value, column.format)}</Text>
        },
      })),
    [block.columns],
  )

  return (
    <Box display="flex" flexDirection="column" rowGap="s">
      <DataTable columns={columns} data={block.rows} isLoading={false} />
      {block.total_count > block.rows.length ? (
        <Text variant="caption" color="muted">
          Showing {block.rows.length} of {block.total_count} {block.entity}
        </Text>
      ) : null}
    </Box>
  )
}
