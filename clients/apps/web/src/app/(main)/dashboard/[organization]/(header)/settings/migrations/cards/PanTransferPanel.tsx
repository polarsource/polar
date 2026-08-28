'use client'

import { usePanTransfer } from '@/hooks/queries/merchantMigrations'
import { Alert, Spinner, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { PanTransferStepItem } from './PanTransferStepItem'

export function PanTransferPanel({
  migrationId,
  sourceStripeAccountId,
}: {
  migrationId: string
  sourceStripeAccountId?: string
}) {
  const { data: checklist, isLoading, isError } = usePanTransfer(migrationId)

  if (isLoading) {
    return (
      <Box padding="2xl" alignItems="center" justifyContent="center">
        <Spinner />
      </Box>
    )
  }

  if (isError || !checklist) {
    return (
      <Alert
        variant="danger"
        title="We couldn't load the card transfer"
        description="Something went wrong. Please refresh and try again."
      />
    )
  }

  if (!checklist.started) {
    return (
      <Text variant="caption" color="muted">
        The card transfer hasn&apos;t started yet.
      </Text>
    )
  }

  const done = checklist.steps.filter(
    (step) => step.status === 'completed',
  ).length
  // Off the steps, not a null `current_step_key`: a checklist stuck with
  // nothing actionable would report that too.
  const finished = done === checklist.steps.length

  return (
    <Box flexDirection="column" rowGap="l">
      {finished ? (
        <Text variant="caption" color="muted">
          Every step is complete.
        </Text>
      ) : (
        <Text variant="caption" color="muted">
          {done} of {checklist.steps.length} complete
        </Text>
      )}

      <Box as="ol" flexDirection="column" rowGap="l">
        {checklist.steps.map((step) => (
          <PanTransferStepItem
            // Migration-scoped: another migration lands on the same step key,
            // and a bare key would keep its unsaved form values alive.
            key={`${migrationId}:${step.key}`}
            step={step}
            current={step.key === checklist.current_step_key}
            destinationAccountId={checklist.destination_account_id}
            migrationId={migrationId}
            sourceStripeAccountId={sourceStripeAccountId}
          />
        ))}
      </Box>
    </Box>
  )
}
