'use client'

import { usePanTransfer } from '@/hooks/queries/merchantMigrations'
import { schemas } from '@polar-sh/client'
import { Alert, Spinner, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { PanTransferStepItem } from './PanTransferStepItem'

const METHOD_INTRO: Record<schemas['PanTransferMethod'], string> = {
  pan_copy:
    "Stripe copies your customers' saved cards onto Polar's Stripe account. Nothing changes for your customers.",
  pan_import:
    "Your provider sends the saved cards to Stripe, and Stripe imports them onto Polar's account. This runs over a few weeks.",
}

export function PanTransferPanel({
  migrationId,
  organizationId,
}: {
  migrationId: string
  organizationId: string
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
    <Box flexDirection="column" rowGap="xl">
      {finished ? (
        <Alert
          variant="success"
          title="Every step is done"
          description="Your customers' cards are on Polar and their subscriptions have moved over."
        />
      ) : (
        <Box flexDirection="column" rowGap="xs">
          <Text variant="caption" color="muted">
            {METHOD_INTRO[checklist.method]}
          </Text>
          <Text variant="caption" color="muted">
            {done} of {checklist.steps.length} steps done
          </Text>
        </Box>
      )}

      <Box as="ol" flexDirection="column" rowGap="xl">
        {checklist.steps.map((step) => (
          <PanTransferStepItem
            // Migration-scoped: another migration lands on the same step key,
            // and a bare key would keep its unsaved form values alive.
            key={`${migrationId}:${step.key}`}
            step={step}
            current={step.key === checklist.current_step_key}
            destinationAccountId={checklist.destination_account_id}
            migrationId={migrationId}
            organizationId={organizationId}
          />
        ))}
      </Box>
    </Box>
  )
}
