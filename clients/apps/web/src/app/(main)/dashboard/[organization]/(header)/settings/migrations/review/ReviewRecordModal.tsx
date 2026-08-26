'use client'

import {
  DetailColumn,
  type DetailColumnRow,
} from '@/components/Orders/OrderSection'
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
  const importItems: DetailColumnRow[] = [
    {
      key: 'status',
      label: 'Status',
      value: <ReviewStatusIndicator row={row} />,
    },
    {
      key: 'source_id',
      label: 'Stripe ID',
      value: (
        <Text color="muted" monospace>
          {row.source_id}
        </Text>
      ),
    },
  ]

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
          <DetailColumn title="Import" items={importItems} />
        )}
        <ProductFields row={row} />
        <CustomerFields row={row} />
      </Box>
    </Box>
  )
}
