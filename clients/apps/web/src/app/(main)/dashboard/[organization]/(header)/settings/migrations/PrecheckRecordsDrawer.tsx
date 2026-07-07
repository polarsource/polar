'use client'

import { useMigrationRecords } from '@/hooks/queries/merchantMigrations'
import { schemas } from '@polar-sh/client'
import {
  Button,
  InlineModalHeader,
  SegmentedControl,
  Spinner,
  Status,
  Text,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'
import { ENTITY_LABELS } from './reasons'

const LIMIT = 20

type Entity = schemas['PrecheckEntity']
type RecordStatus = schemas['PrecheckRecordStatus']
type Filter = '' | RecordStatus

const FILTERS: { label: string; value: Filter }[] = [
  { label: 'All', value: '' },
  { label: 'Importing', value: 'importable' },
  { label: 'Stay on Stripe', value: 'skipped' },
]

export function PrecheckRecordsDrawer({
  migrationId,
  entity,
  onClose,
}: {
  migrationId: string
  entity: Entity
  onClose: () => void
}) {
  const [filter, setFilter] = useState<Filter>('')
  const [page, setPage] = useState(1)
  const { data, isLoading } = useMigrationRecords(migrationId, {
    entity,
    status: filter || undefined,
    page,
    limit: LIMIT,
  })

  const items = data?.items ?? []
  const total = data?.pagination.total_count ?? 0
  const maxPage = Math.max(1, Math.ceil(total / LIMIT))

  return (
    <Box flexDirection="column" height="100%">
      <InlineModalHeader hide={onClose}>
        <Text variant="heading-xs" as="h2">
          {ENTITY_LABELS[entity] ?? entity}
        </Text>
      </InlineModalHeader>

      <Box
        flexDirection="column"
        rowGap="l"
        padding="xl"
        flex={1}
        overflowY="auto"
      >
        <SegmentedControl
          options={FILTERS}
          value={filter}
          onChange={(value) => {
            setFilter(value)
            setPage(1)
          }}
        />

        {isLoading ? (
          <Box padding="2xl" alignItems="center" justifyContent="center">
            <Spinner />
          </Box>
        ) : items.length === 0 ? (
          <Text variant="caption" color="muted">
            No {ENTITY_LABELS[entity]?.toLowerCase() ?? 'records'} here.
          </Text>
        ) : (
          <Box as="ul" flexDirection="column">
            {items.map((item) => (
              <RecordRow key={item.source_id} item={item} />
            ))}
          </Box>
        )}

        {maxPage > 1 && (
          <Box alignItems="center" justifyContent="between">
            <Button
              size="sm"
              variant="ghost"
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              Previous
            </Button>
            <Text variant="caption" color="muted">
              {page} / {maxPage}
            </Text>
            <Button
              size="sm"
              variant="ghost"
              disabled={page >= maxPage}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  )
}

function RecordRow({ item }: { item: schemas['MerchantMigrationRecordItem'] }) {
  const skipped = item.status === 'skipped'
  return (
    <Box
      as="li"
      flexDirection="column"
      rowGap="xs"
      paddingVertical="m"
      borderBottomWidth={1}
      borderStyle="solid"
      borderColor="border-secondary"
    >
      <Box alignItems="center" justifyContent="between" columnGap="m">
        <Box flexDirection="column" rowGap="xs" flex={1}>
          <Text variant="body">{item.title}</Text>
          {item.subtitle && (
            <Text variant="caption" color="muted">
              {item.subtitle}
            </Text>
          )}
        </Box>
        <Status
          status={skipped ? 'Stays on Stripe' : 'Importing'}
          color={skipped ? 'yellow' : 'green'}
          size="small"
        />
      </Box>
      {item.reason && (
        <Text variant="caption" color="muted">
          {item.reason}
        </Text>
      )}
      <Text variant="caption" color="muted" monospace>
        {item.source_id}
      </Text>
    </Box>
  )
}
