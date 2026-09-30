'use client'

import { useStartPanTransfer } from '@/hooks/queries/merchantMigrations'
import { ButtonGroup, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  importedCountsText,
  importedTotal,
  nothingImported,
  plural,
  preparedEarlier,
} from './review/importSummary'
import type { useRecordSummary } from './review/recordSummary'

type ImportOutcome = ReturnType<typeof useRecordSummary>

interface Props {
  migrationId: string
  outcome: ImportOutcome
  onReviewRecords: () => void
}

const UNCOUNTED = 'Your catalog is now in Polar.'
const CARDS_AT_STRIPE =
  "Your customers' cards are still at Stripe. Moving them lets Polar charge " +
  'them. This is a checklist. You can leave and come back.'
const MAYBE_ON_POLAR =
  'These subscriptions were prepared in an earlier migration. If their ' +
  "cards are already on Polar, you'll go straight to the switch. Otherwise " +
  "you'll get a checklist to move them."
const NOTHING_TO_MOVE =
  'There is nothing to move yet. Prepare your subscriptions first, then come ' +
  "back to move your customers' saved cards."

function receipt(outcome: ImportOutcome, nothingLanded: boolean): string {
  if (outcome.isLoading || outcome.isError) {
    return UNCOUNTED
  }
  const total = importedTotal(outcome.imported)
  if (total === 0) {
    // Mid-refetch this zero is still the pre-import number.
    return nothingLanded
      ? 'No records were imported. Everything stayed on Stripe.'
      : UNCOUNTED
  }
  const verb = total === 1 ? 'is' : 'are'
  return `${importedCountsText(outcome.imported)} ${verb} now in Polar.`
}

// The import receipt and the handoff to card movement in one panel, so the
// merchant never has to hunt for what comes next.
export function ImportedHandoff({
  migrationId,
  outcome,
  onReviewRecords,
}: Props) {
  const start = useStartPanTransfer(migrationId)
  const remaining = plural(outcome.selectableTotal, 'subscription')
  const landed = {
    ...outcome,
    readyToSwitch: outcome.counts.subscriptions.ready,
  }
  const nothingLanded = nothingImported(landed)
  const earlier = preparedEarlier(landed)

  return (
    <Box
      flexDirection="column"
      padding="xl"
      rowGap="l"
      borderRadius="l"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      backgroundColor="background-card"
    >
      {/* No success icon: the stepper above already marks Assessment done. */}
      <Box flexDirection="column" rowGap="xs">
        <Text variant="heading-xs" as="h3">
          Catalog imported
        </Text>
        <Text variant="caption" color="muted">
          {receipt(outcome, nothingLanded)}
        </Text>
      </Box>

      <Box
        borderTopWidth={1}
        borderStyle="solid"
        borderColor="border-secondary"
      />

      <Box flexDirection="column" rowGap="xs">
        <Text variant="heading-xs" as="h3">
          {earlier ? 'Next: check saved cards' : 'Next: move saved cards'}
        </Text>
        <Text variant="caption" color="muted">
          {nothingLanded
            ? NOTHING_TO_MOVE
            : earlier
              ? MAYBE_ON_POLAR
              : CARDS_AT_STRIPE}
        </Text>
      </Box>

      {start.error && (
        <Text variant="caption" color="danger" role="alert">
          {start.error.message}
        </Text>
      )}

      <ButtonGroup
        size="sm"
        actions={[
          {
            text: start.isPending
              ? 'Starting…'
              : earlier
                ? 'Continue'
                : 'Start moving cards',
            // Not disabled on success: that would strand the merchant if the
            // refetch which unmounts this card never arrives, and a second
            // click is merely a recoverable "already started".
            disabled: start.isPending || nothingLanded,
            onClick: () => start.mutate(),
          },
          { text: 'Review records', onClick: onReviewRecords },
        ]}
      />

      {/* Suppressed when nothing landed: "before you start" would point at a
          disabled CTA, while the copy above sends them back to import. */}
      {remaining && !nothingLanded && (
        <Text variant="caption" color="muted">
          {remaining} {outcome.selectableTotal === 1 ? 'was' : 'were'} not
          prepared. You can still prepare{' '}
          {outcome.selectableTotal === 1 ? 'it' : 'them'} before you start.
        </Text>
      )}
    </Box>
  )
}
