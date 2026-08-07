'use client'

import { useStartPanTransfer } from '@/hooks/queries/merchantMigrations'
import { useMigrationImportOutcome } from '@/hooks/queries/merchantMigrationCounts'
import { ButtonGroup, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { CheckCircle2 } from 'lucide-react'
import {
  importedCountsText,
  importedTotal,
  plural,
} from './review/importSummary'

type ImportOutcome = ReturnType<typeof useMigrationImportOutcome>

interface Props {
  migrationId: string
  outcome: ImportOutcome
  onReviewRecords: () => void
}

const PAUSED_NOTE = 'Subscriptions are paused. Nothing is billed until cutover.'

// Names the counts whenever the ledger has them. While they load, or if that
// read fails, the import still succeeded, so the panel says so without numbers
// rather than reading as broken.
function receipt(outcome: ImportOutcome): string {
  if (outcome.isLoading || outcome.isError) {
    return `Your products, customers and subscriptions are now in Polar. ${PAUSED_NOTE}`
  }
  const total = importedTotal(outcome.imported)
  if (total === 0) {
    return 'No records were imported. Everything stayed on Stripe.'
  }
  const verb = total === 1 ? 'is' : 'are'
  return `${importedCountsText(outcome.imported)} ${verb} now in Polar. ${PAUSED_NOTE}`
}

// The receipt for the catalog import and the handoff to card movement, in one
// panel. Both halves are here so the merchant never has to hunt for what comes
// next, and the counts come from the ledger so a reload doesn't lose the
// receipt.
export function ImportedHandoff({
  migrationId,
  outcome,
  onReviewRecords,
}: Props) {
  const start = useStartPanTransfer(migrationId)
  const remaining = plural(outcome.remaining, 'record')

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
      <Box flexDirection="column" rowGap="xs">
        <Box alignItems="center" columnGap="s">
          <Box color="text-success" alignItems="center">
            <CheckCircle2 size={18} />
          </Box>
          <Text variant="heading-xs" as="h3">
            Catalog imported
          </Text>
        </Box>
        <Text variant="caption" color="muted">
          {receipt(outcome)}
        </Text>
      </Box>

      <Box
        borderTopWidth={1}
        borderStyle="solid"
        borderColor="border-secondary"
      />

      <Box flexDirection="column" rowGap="xs">
        <Text variant="heading-xs" as="h3">
          Next: move saved cards
        </Text>
        <Text variant="caption" color="muted">
          Your customers&apos; cards are still at Stripe. Moving them lets Polar
          charge them. This is a checklist. You can leave and come back.
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
            text: start.isPending ? 'Starting…' : 'Start moving cards',
            // In-flight only. Disabling on success strands the merchant if the
            // refetch that unmounts this card never lands; a second click is
            // merely a recoverable "already started".
            disabled: start.isPending,
            onClick: () => start.mutate(),
          },
          { text: 'Review records', onClick: onReviewRecords },
        ]}
      />

      {remaining && (
        <Text variant="caption" color="muted">
          {remaining} {outcome.remaining === 1 ? 'was' : 'were'} not imported.
          You can still import {outcome.remaining === 1 ? 'it' : 'them'} before
          you start.
        </Text>
      )}
    </Box>
  )
}
