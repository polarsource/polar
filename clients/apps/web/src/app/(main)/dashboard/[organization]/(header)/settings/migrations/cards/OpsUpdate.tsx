'use client'

import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'

export function OpsUpdate({ step }: { step: schemas['PanTransferStep'] }) {
  if (!step.note && !step.expected_at) {
    return null
  }

  return (
    <Box
      flexDirection="column"
      rowGap="xs"
      padding="l"
      borderRadius="m"
      backgroundColor="background-secondary"
    >
      {/* Prose wraps on its own; a pasted link does not. */}
      {step.note && (
        <Box overflowX="auto" maxWidth="100%">
          <Text variant="caption">{step.note}</Text>
        </Box>
      )}
      {step.expected_at && (
        <Text variant="caption" color="muted">
          Expected by <FormattedDateTime datetime={step.expected_at} />
        </Text>
      )}
    </Box>
  )
}
