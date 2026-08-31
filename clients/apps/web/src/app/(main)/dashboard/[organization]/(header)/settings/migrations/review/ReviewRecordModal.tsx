'use client'

import { DetailCell } from '@/components/Orders/OrderSection'
import { Alert, InlineModalHeader, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { needsAttention, ReviewRow } from './reviewRows'
import { ReviewStatusIndicator } from './ReviewStatusIndicator'
import {
  CustomerFields,
  ProductFields,
  SubscriptionFields,
} from './ReviewRecordFields'

export function ReviewRecordModal({
  row,
  onClose,
}: {
  row: ReviewRow
  onClose: () => void
}) {
  const isSubscription = row.entity === 'subscriptions'

  return (
    <Box flexDirection="column" height="100%">
      <InlineModalHeader hide={onClose}>
        <Text variant="heading-xs" as="h2">
          {row.customer_email || row.title}
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

        {isSubscription ? (
          <SubscriptionFields row={row} />
        ) : (
          <Box flexDirection="column" rowGap="l" minWidth={0}>
            <Text variant="body" as="h3">
              Import
            </Text>
            <Box flexDirection="column" rowGap="m" minWidth={0}>
              <DetailCell
                label="Status"
                value={<ReviewStatusIndicator row={row} />}
              />
              <DetailCell label="Stripe ID" value={row.source_id} monospace />
            </Box>
          </Box>
        )}
        <ProductFields row={row} />
        <CustomerFields row={row} />
      </Box>
    </Box>
  )
}
