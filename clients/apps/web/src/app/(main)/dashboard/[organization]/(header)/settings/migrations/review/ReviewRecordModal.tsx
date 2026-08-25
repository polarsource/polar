'use client'

import { Alert, InlineModalHeader, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { ReactNode } from 'react'
import {
  needsAttention,
  ReviewRow,
  renewsLabel,
  rowAmount,
} from './reviewRows'
import { ReviewStatusIndicator } from './ReviewStatusIndicator'

export function ReviewRecordModal({
  row,
  onClose,
}: {
  row: ReviewRow
  onClose: () => void
}) {
  const amount = rowAmount(row)
  const renews = renewsLabel(row)

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

        <Box as="section" flexDirection="column" rowGap="m">
          <Field label="Import">
            <ReviewStatusIndicator row={row} />
          </Field>
          {row.product_name ? (
            <Field label="Product">
              <Text>{row.product_name}</Text>
            </Field>
          ) : row.reason_code === 'subscription_product_not_importable' ? (
            <Field label="Product">
              <Text color="muted">Not in Stripe catalog</Text>
            </Field>
          ) : null}
          {amount && (
            <Field label="Amount">
              <Text monospace tabularNums>
                {amount.money}
                {amount.interval ?? ''}
              </Text>
            </Field>
          )}
          {(row.customer_email || row.title) && (
            <Field label="Customer">
              <Text>{row.customer_email || row.title}</Text>
            </Field>
          )}
          <Field label="Country">
            <Text color={row.customer_country ? 'default' : 'muted'}>
              {row.customer_country || 'No billing country'}
            </Text>
          </Field>
          {row.subtitle && (
            <Field label="Stripe status">
              <Text>{row.subtitle}</Text>
            </Field>
          )}
          {row.renews_at && (
            <Field label="Renews">
              <Box flexDirection="column" alignItems="end" rowGap="3xs">
                <FormattedDateTime datetime={row.renews_at} />
                {renews && (
                  <Text variant="caption" color="muted">
                    {renews}
                  </Text>
                )}
              </Box>
            </Field>
          )}
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
