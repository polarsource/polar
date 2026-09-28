'use client'

import { DetailCell } from '@/components/Orders/OrderSection'
import { Alert, InlineModalHeader, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { assessmentFacts } from '../review/assessmentFacts'
import { RecordCard, TaxAfterSwitchField } from '../review/ReviewRecordFields'
import { SwitchStatusIndicator } from './SwitchStatusIndicator'
import { needsAttention, SwitchRow } from './switchRows'

export function SwitchRecordModal({
  row,
  migrationId,
  onClose,
}: {
  row: SwitchRow
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
            <SwitchStatusIndicator row={row} />
          </Box>
          {row.cutover_error ? (
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
          ) : null}
          <TaxAfterSwitchField row={row} migrationId={migrationId} />
        </Box>

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

        <RecordCard
          title="Subscription"
          action={<SwitchStatusIndicator row={row} />}
        >
          {facts.status ? (
            <DetailCell label="Status" value={facts.status} />
          ) : null}
          <DetailCell
            label="Payment method"
            value={
              row.has_payment_method === false
                ? 'No payment method'
                : row.has_payment_method
                  ? 'Ready to charge'
                  : null
            }
          />
          {discount ? <DetailCell label="Discount" value={discount} /> : null}
          <DetailCell label="Renewal on Stripe" value={facts.renewal} />
          {facts.automaticTax ? (
            <DetailCell
              label="Stripe automatic tax"
              value={facts.automaticTax}
            />
          ) : null}
          <DetailCell
            label="Stripe subscription ID"
            value={facts.sourceId}
            monospace
          />
        </RecordCard>
      </Box>
    </Box>
  )
}
