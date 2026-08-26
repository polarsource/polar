'use client'

import { DetailCell } from '@/components/Orders/OrderSection'
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

        <Box flexDirection="column" rowGap="l" minWidth={0}>
          <Text variant="body" as="h3">
            Subscription
          </Text>
          <Box flexDirection="column" rowGap="m" minWidth={0}>
            <DetailCell
              label="Switch"
              value={<SwitchStatusIndicator row={row} />}
            />
            {row.subtitle ? (
              <DetailCell label="Status" value={row.subtitle} />
            ) : null}
            <DetailCell
              label="Payment method"
              value={row.has_payment_method ? 'Ready to charge' : null}
            />
            <DetailCell label="Renewal on Stripe" value={renewalDate(row)} />
            <DetailCell
              label="Stripe subscription ID"
              value={row.source_id}
              monospace
            />
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
