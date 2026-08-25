'use client'

import { Alert, InlineModalHeader, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Field, FieldSection, FieldValue } from '../recordFields'
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
  const renewal = renewalDate(row)

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

        <FieldSection title="Subscription">
          <Field label="Switch">
            <SwitchStatusIndicator row={row} />
          </Field>
          {row.subtitle && (
            <Field label="Status">
              <FieldValue>{row.subtitle}</FieldValue>
            </Field>
          )}
          <Field label="Payment method">
            <FieldValue muted={!row.has_payment_method}>
              {row.has_payment_method ? 'Ready to charge' : 'None yet'}
            </FieldValue>
          </Field>
          {renewal && (
            <Field label="Renewal on Stripe">
              <FieldValue>{renewal}</FieldValue>
            </Field>
          )}
          <Field label="Stripe subscription ID">
            <FieldValue monospace muted>
              {row.source_id}
            </FieldValue>
          </Field>
        </FieldSection>
      </Box>
    </Box>
  )
}
