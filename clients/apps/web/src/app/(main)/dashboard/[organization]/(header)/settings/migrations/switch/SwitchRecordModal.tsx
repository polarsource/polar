'use client'

import { Alert, InlineModalHeader, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { ReactNode } from 'react'
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

        <Box as="section" flexDirection="column" rowGap="m">
          <Field label="Status">
            <SwitchStatusIndicator row={row} />
          </Field>
          {row.subtitle && (
            <Field label="Stripe status">
              <Text>{row.subtitle}</Text>
            </Field>
          )}
          <Field label="Payment method">
            <Text color={row.has_payment_method ? 'default' : 'danger'}>
              {row.has_payment_method ? 'Ready to charge' : 'None yet'}
            </Text>
          </Field>
          {row.renews_at && (
            <Field label="Renews on Stripe">
              <FormattedDateTime datetime={row.renews_at} />
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
