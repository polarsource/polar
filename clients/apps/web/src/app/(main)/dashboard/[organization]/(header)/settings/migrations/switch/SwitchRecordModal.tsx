'use client'

import {
  DetailColumn,
  type DetailColumnRow,
} from '@/components/Orders/OrderSection'
import { Alert, InlineModalHeader, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { renewalDate } from '../recordFormat'
import { SwitchStatusIndicator } from './SwitchStatusIndicator'
import { needsAttention, SwitchRow } from './switchRows'

export function SwitchRecordModal({
  row,
  onClose,
}: {
  row: SwitchRow
  onClose: () => void
}) {
  const items: DetailColumnRow[] = [
    {
      key: 'switch',
      label: 'Switch',
      value: <SwitchStatusIndicator row={row} />,
    },
  ]

  if (row.subtitle) {
    items.push({ key: 'status', label: 'Status', value: row.subtitle })
  }
  items.push({
    key: 'payment_method',
    label: 'Payment method',
    value: row.has_payment_method ? 'Ready to charge' : null,
  })
  items.push({
    key: 'renewal',
    label: 'Renewal on Stripe',
    value: renewalDate(row),
  })
  items.push({
    key: 'source_id',
    label: 'Stripe subscription ID',
    value: (
      <Text color="muted" monospace>
        {row.source_id}
      </Text>
    ),
  })

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
        {row.cutover_error && (
          <Box>
            <Alert
              variant={needsAttention(row) ? 'warning' : 'info'}
              title={
                row.cutover_status === 'failed'
                  ? 'This one failed'
                  : 'Left on Stripe'
              }
              description={row.cutover_error}
            />
          </Box>
        )}

        <DetailColumn title="Subscription" items={items} />
      </Box>
    </Box>
  )
}
