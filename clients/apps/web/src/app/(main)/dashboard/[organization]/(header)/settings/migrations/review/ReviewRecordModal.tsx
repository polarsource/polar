'use client'

import { Alert, InlineModalHeader, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Circle } from 'lucide-react'
import { ReactNode } from 'react'
import {
  entityLabelSingular,
  needsAttention,
  ReviewRow,
  rowAmount,
} from './reviewRows'
import { reviewStatus } from './reviewStatus'

// What `subtitle` carries depends on the entity it came from.
const SUBTITLE_LABELS: Record<ReviewRow['entity'], string> = {
  subscriptions: 'Stripe status',
  customers: 'Country',
  products: 'Billing',
  prices: 'Price',
}

export function ReviewRecordModal({
  row,
  onClose,
}: {
  row: ReviewRow
  onClose: () => void
}) {
  const { label, dot } = reviewStatus(row)
  const amount = rowAmount(row)

  return (
    <Box flexDirection="column" height="100%">
      <InlineModalHeader hide={onClose}>
        <Text variant="heading-xs" as="h2">
          {row.title}
        </Text>
      </InlineModalHeader>

      <Box
        flexDirection="column"
        rowGap="xl"
        padding="xl"
        flex={1}
        overflowY="auto"
      >
        {row.reason && (
          // Alert grows to fill a column parent, so keep it in its own row.
          <Box>
            <Alert
              variant={needsAttention(row) ? 'warning' : 'info'}
              title={
                needsAttention(row) ? 'Needs your attention' : 'Good to know'
              }
              description={row.reason}
            />
          </Box>
        )}

        <Box as="section" flexDirection="column" rowGap="m">
          <Field label="Type">
            <Text>{entityLabelSingular(row.entity)}</Text>
          </Field>
          <Field label="Import">
            <Box alignItems="center" columnGap="s">
              <Box color={dot} alignItems="center" flexShrink={0}>
                <Circle size={8} fill="currentColor" strokeWidth={0} />
              </Box>
              <Text>{label}</Text>
            </Box>
          </Field>
          {amount && (
            <Field label="Amount">
              <Text monospace tabularNums>
                {amount.money}
                {amount.interval ?? ''}
              </Text>
            </Field>
          )}
          {row.subtitle && (
            <Field label={SUBTITLE_LABELS[row.entity]}>
              <Text>{row.subtitle}</Text>
            </Field>
          )}
          {/* Only the failed case says something "Import" doesn't already. */}
          {row.import_status === 'failed' && (
            <Field label="Last run">
              <Text color="danger">Failed</Text>
            </Field>
          )}
          <Field label="Stripe ID">
            <Text monospace variant="caption" color="muted">
              {row.source_id}
            </Text>
          </Field>
        </Box>
      </Box>
    </Box>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box alignItems="baseline" columnGap="l" justifyContent="between">
      <Text variant="caption" color="muted">
        {label}
      </Text>
      <Box minWidth={0} justifyContent="end">
        {children}
      </Box>
    </Box>
  )
}
