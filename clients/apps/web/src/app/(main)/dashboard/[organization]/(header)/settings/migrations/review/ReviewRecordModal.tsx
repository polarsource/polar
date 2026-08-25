'use client'

import { Alert, InlineModalHeader, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Field, FieldSection, FieldValue } from '../recordFields'
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
          <FieldSection title="Import">
            <Field label="Import">
              <ReviewStatusIndicator row={row} />
            </Field>
            <Field label="Stripe ID">
              <FieldValue monospace muted>
                {row.source_id}
              </FieldValue>
            </Field>
          </FieldSection>
        )}
        <ProductFields row={row} />
        <CustomerFields row={row} />
      </Box>
    </Box>
  )
}
