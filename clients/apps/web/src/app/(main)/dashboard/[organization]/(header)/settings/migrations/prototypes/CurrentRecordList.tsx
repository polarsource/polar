'use client'

import { Button, Checkbox, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'
import { MockSubscriptionRecord } from './mockData'
import {
  CATEGORY_LABELS,
  OWNER_LABELS,
  STATUS_LABELS,
  statusColor,
} from './recordLabels'
import { resolveBillingOwner } from './selectors'

export function CurrentRecordRow({
  record,
  selected,
  selectable = false,
  onToggle,
  transferred = false,
  emphasize = false,
}: {
  record: MockSubscriptionRecord
  selected?: boolean
  selectable?: boolean
  onToggle?: () => void
  transferred?: boolean
  emphasize?: boolean
}) {
  const [open, setOpen] = useState(false)
  const owner = resolveBillingOwner(record, transferred)
  const detailId = `${record.id}-current-detail`

  return (
    <Box
      as="li"
      flexDirection="column"
      rowGap="s"
      padding="m"
      borderRadius="m"
      borderWidth={1}
      borderStyle="solid"
      borderColor={emphasize ? 'border-warning' : 'border-secondary'}
      backgroundColor={emphasize ? 'background-warning' : 'background-card'}
    >
      <Box
        alignItems={{ base: 'start', md: 'center' }}
        justifyContent="between"
        gap="m"
        flexDirection={{ base: 'column', md: 'row' }}
      >
        <Box alignItems="center" columnGap="m" minWidth={0} flex={1}>
          {selectable ? (
            <Checkbox
              checked={Boolean(selected)}
              aria-label={`Select ${record.customerLabel}`}
              onCheckedChange={() => onToggle?.()}
            />
          ) : null}
          <Box flexDirection="column" rowGap="xs" minWidth={0}>
            <Text variant="body" truncate>
              {record.customerLabel}
            </Text>
            <Text variant="caption" color="muted" truncate>
              {record.customerEmail ?? 'No email'} · {record.planLabel}
            </Text>
          </Box>
        </Box>
        <Box gap="s" flexWrap="wrap" alignItems="center">
          <Status
            status={
              record.category === 'clean'
                ? 'Ready'
                : CATEGORY_LABELS[record.category]
            }
            color="gray"
            size="small"
          />
          <Status
            status={STATUS_LABELS[record.status]}
            color={statusColor(record.status)}
            size="small"
          />
          <Status
            status={OWNER_LABELS[owner]}
            color={owner === 'polar' ? 'green' : 'gray'}
            size="small"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={open}
            aria-controls={detailId}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? 'Hide' : 'Details'}
          </Button>
        </Box>
      </Box>
      {open ? (
        <Box
          id={detailId}
          flexDirection="column"
          rowGap="xs"
          paddingTop="s"
          borderTopWidth={1}
          borderStyle="solid"
          borderColor="border-secondary"
        >
          <Text variant="caption">{record.title}</Text>
          <Text variant="caption" color="muted">
            {record.detail}
          </Text>
          <Text variant="caption">Recommended: {record.recommendedAction}</Text>
        </Box>
      ) : null}
    </Box>
  )
}
