'use client'

import { DetailCell } from '@/components/Orders/OrderSection'
import { InlineModalHeader, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { assessmentFacts } from './assessmentFacts'
import {
  BillingCountryField,
  RecordCard,
  RecordReason,
  TaxAfterSwitchField,
} from './ReviewRecordFields'
import { ReviewStatusIndicator } from './ReviewStatusIndicator'
import { ReviewRow } from './reviewRows'

export function ReviewRecordModal({
  row,
  migrationId,
  onClose,
}: {
  row: ReviewRow
  migrationId: string
  onClose: () => void
}) {
  const facts = assessmentFacts(row)
  const discount = row.discount_name
    ? row.discount_code
      ? `${row.discount_name} (${row.discount_code})`
      : row.discount_name
    : null
  const showCustomer = Boolean(
    facts.customerName || row.customer_email || facts.customerId,
  )

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
        minWidth={0}
        overflowY="auto"
      >
        {facts.isSubscription ? (
          <Box
            flexDirection="column"
            rowGap="l"
            padding="l"
            borderRadius="l"
            borderWidth={1}
            borderStyle="solid"
            borderColor="border-primary"
          >
            <Box alignItems="center" justifyContent="between" columnGap="m">
              <Text variant="heading-xs" as="h3">
                Before switch
              </Text>
              <ReviewStatusIndicator row={row} />
            </Box>
            <RecordReason row={row} />
            <BillingCountryField row={row} migrationId={migrationId} />
            <TaxAfterSwitchField row={row} migrationId={migrationId} />
          </Box>
        ) : (
          <RecordReason row={row} />
        )}

        {showCustomer ? (
          <RecordCard title="Customer">
            {facts.customerName ? (
              <DetailCell label="Name" value={facts.customerName} />
            ) : null}
            {row.customer_email ? (
              <DetailCell label="Email" value={row.customer_email} />
            ) : null}
            {facts.customerId ? (
              <DetailCell
                label="Stripe customer ID"
                value={facts.customerId}
                monospace
              />
            ) : null}
          </RecordCard>
        ) : null}

        {facts.showProduct ? (
          <RecordCard title="Product">
            {facts.productName ? (
              <DetailCell label="Name" value={facts.productName} />
            ) : null}
            {facts.price ? (
              <DetailCell label="Price" value={facts.price} />
            ) : null}
            {facts.interval ? (
              <DetailCell label="Renewal interval" value={facts.interval} />
            ) : null}
            {facts.productId ? (
              <DetailCell
                label="Stripe product ID"
                value={facts.productId}
                monospace
              />
            ) : null}
          </RecordCard>
        ) : null}

        {facts.isSubscription ? (
          <RecordCard
            title="Subscription"
            action={<ReviewStatusIndicator row={row} />}
          >
            {facts.status ? (
              <DetailCell label="Status" value={facts.status} />
            ) : null}
            {discount ? <DetailCell label="Discount" value={discount} /> : null}
            {facts.renewal ? (
              <DetailCell label="Renewal" value={facts.renewal} />
            ) : null}
            {facts.automaticTax ? (
              <DetailCell
                label="Stripe automatic tax"
                value={facts.automaticTax}
              />
            ) : null}
            {facts.failed ? (
              <DetailCell label="Last run" value="Failed" />
            ) : null}
            <DetailCell
              label="Stripe subscription ID"
              value={facts.sourceId}
              monospace
            />
          </RecordCard>
        ) : (
          <RecordCard title="Import">
            <DetailCell
              label="Status"
              value={<ReviewStatusIndicator row={row} />}
            />
            <DetailCell label="Stripe ID" value={facts.sourceId} monospace />
          </RecordCard>
        )}
      </Box>
    </Box>
  )
}
