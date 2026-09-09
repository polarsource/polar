'use client'

import { Button, Status, Text } from '@polar-sh/orbit'
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

export function RecordRow({
  record,
  transferred = false,
  emphasize = false,
}: {
  record: MockSubscriptionRecord
  transferred?: boolean
  emphasize?: boolean
}) {
  const [open, setOpen] = useState(emphasize)
  const owner = resolveBillingOwner(record, transferred)
  const detailId = `${record.id}-detail`

  return (
    <Box
      as="li"
      flexDirection="column"
      rowGap="s"
      padding="l"
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
        <Box flexDirection="column" rowGap="xs" minWidth={0}>
          <Text variant="body">{record.title}</Text>
          <Text variant="caption" color="muted" truncate>
            {record.customerLabel}
            {record.customerEmail ? ` · ${record.customerEmail}` : ''}
            {` · ${record.planLabel}`}
          </Text>
        </Box>
        <Box gap="s" flexWrap="wrap" alignItems="center">
          <Status
            status={CATEGORY_LABELS[record.category]}
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
            aria-label={
              open
                ? `Hide detail for ${record.customerLabel}`
                : `Show detail for ${record.customerLabel}`
            }
            onClick={() => setOpen((current) => !current)}
          >
            {open ? 'Hide detail' : 'Show detail'}
          </Button>
        </Box>
      </Box>
      {open ? (
        <Box
          id={detailId}
          flexDirection="column"
          rowGap="s"
          paddingTop="s"
          borderTopWidth={1}
          borderStyle="solid"
          borderColor="border-secondary"
        >
          <Text variant="caption" color="muted">
            {record.detail}
          </Text>
          <Text variant="caption">Recommended: {record.recommendedAction}</Text>
        </Box>
      ) : null}
    </Box>
  )
}
