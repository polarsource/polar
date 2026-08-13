'use client'

import { relativeTime } from '@/components/Chat/time'
import {
  AssistantBlock,
  DataTableColumn,
  DataTableRow,
} from '@/hooks/useCompassAssistant'
import { Avatar, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { DataTable, DataTableColumnDef, List, ListItem } from '@polar-sh/orbit'
import { useMemo } from 'react'

const rowName = (row: DataTableRow, columns: DataTableColumn[]): string => {
  const nameColumn = columns.find(
    (column) => column.format === 'text' && row[column.key] !== null,
  )
  return nameColumn ? String(row[nameColumn.key]) : ''
}

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

/**
 * The caption under the entity presentations: how much of the result is shown,
 * and when it was fetched. One line, so a restored answer's staleness sits with
 * its data rather than adding a caption of its own.
 */
const BlockFooter = ({
  shown,
  total,
  entity,
  answeredAt,
}: {
  shown: number
  total: number
  entity: string
  answeredAt?: string
}) => {
  const parts: string[] = []
  if (total > shown) {
    parts.push(`Showing ${shown} of ${total} ${entity}`)
  }
  if (answeredAt) {
    parts.push(`Fetched ${relativeTime(answeredAt)}`)
  }
  if (parts.length === 0) {
    return null
  }
  return (
    <Text variant="caption" color="muted">
      {parts.join(' · ')}
    </Text>
  )
}

export const EntityListView = ({
  block,
  answeredAt,
}: {
  block: Extract<AssistantBlock, { type: 'entity_list' }>
  answeredAt?: string
}) => {
  // Same columns/rows shape as the table, so currency and dates format
  // identically in both presentations. First column is the title, the last
  // is the right-aligned meta, anything between becomes the description.
  const avatarColumn =
    block.columns[0]?.format === 'avatar' ? block.columns[0] : undefined
  const contentColumns = avatarColumn ? block.columns.slice(1) : block.columns
  const [titleColumn, ...rest] = contentColumns
  const metaColumn = rest.length > 0 ? rest[rest.length - 1] : undefined
  const descriptionColumns = rest.slice(0, -1)
  // Blocks stream from the server without runtime schema validation; a block
  // with no non-avatar columns would otherwise crash on titleColumn.key.
  if (!titleColumn || block.rows.length === 0) {
    return null
  }
  return (
    <Box display="flex" flexDirection="column" rowGap="s">
      {block.title ? (
        <Text variant="caption" color="muted">
          {block.title}
        </Text>
      ) : null}
      <List size="small">
        {block.rows.map((row, i) => (
          <ListItem key={i} size="small">
            <Box
              width="100%"
              display="flex"
              flexDirection="row"
              alignItems="center"
              justifyContent="between"
              columnGap="l"
            >
              {avatarColumn ? (
                <Avatar
                  name={rowName(row, contentColumns)}
                  avatar_url={
                    typeof row[avatarColumn.key] === 'string'
                      ? (row[avatarColumn.key] as string)
                      : null
                  }
                  className="size-8"
                />
              ) : null}
              <Box display="flex" flexDirection="column" flexGrow={1}>
                <Text>
                  {formatCell(row[titleColumn.key], titleColumn.format)}
                </Text>
                {descriptionColumns.length > 0 ? (
                  <Text variant="caption" color="muted">
                    {descriptionColumns
                      .filter((column) => row[column.key] !== null)
                      .map((column) =>
                        formatCell(row[column.key], column.format),
                      )
                      .join(', ')}
                  </Text>
                ) : null}
              </Box>
              {metaColumn && row[metaColumn.key] !== null ? (
                <Text color="muted">
                  {formatCell(row[metaColumn.key], metaColumn.format)}
                </Text>
              ) : null}
            </Box>
          </ListItem>
        ))}
      </List>
      <BlockFooter
        shown={block.rows.length}
        total={block.total_count}
        entity={block.entity}
        answeredAt={answeredAt}
      />
    </Box>
  )
}

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
    <Avatar name={block.name ?? block.email} avatar_url={block.avatar_url} />
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
  answeredAt,
}: {
  block: Extract<AssistantBlock, { type: 'data_table' }>
  answeredAt?: string
}) => {
  const columns = useMemo(
    (): DataTableColumnDef<DataTableRow>[] =>
      block.columns.map((column) => ({
        accessorKey: column.key,
        header: column.label,
        cell: ({ row }) => {
          const value = row.original[column.key]
          if (column.format === 'avatar') {
            return (
              <Avatar
                name={rowName(row.original, block.columns)}
                avatar_url={typeof value === 'string' ? value : null}
                className="size-8"
              />
            )
          }
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
      {block.title ? (
        <Text variant="caption" color="muted">
          {block.title}
        </Text>
      ) : null}
      <DataTable columns={columns} data={block.rows} isLoading={false} />
      <BlockFooter
        shown={block.rows.length}
        total={block.total_count}
        entity={block.entity}
        answeredAt={answeredAt}
      />
    </Box>
  )
}
