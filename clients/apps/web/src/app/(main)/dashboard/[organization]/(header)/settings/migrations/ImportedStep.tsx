'use client'

import { useMigrationImportOutcome } from '@/hooks/queries/merchantMigrationCounts'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useId, useRef, useState } from 'react'
import { ImportedHandoff } from './ImportedHandoff'
import { importedTotal } from './review/importSummary'
import { ReviewTable } from './review/ReviewTable'

// Once the catalog is in Polar the merchant's job here is done, so the records
// table steps back behind the handoff panel. It stays one click away because an
// import can be partial and more records can arrive from Stripe later.
export function ImportedStep({ migrationId }: { migrationId: string }) {
  const [expanded, setExpanded] = useState(false)
  const recordsRef = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const outcome = useMigrationImportOutcome(migrationId)

  // Only the panel's own CTA scrolls: it sends the merchant past content they
  // are already looking at. The section wrapper is always mounted, so this
  // doesn't need to wait for the table to render.
  const reviewRecords = () => {
    setExpanded(true)
    recordsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <Box flexDirection="column" rowGap="l">
      <ImportedHandoff
        migrationId={migrationId}
        outcome={outcome}
        onReviewRecords={reviewRecords}
      />

      <Box
        ref={recordsRef}
        flexDirection="column"
        rowGap="l"
        padding="l"
        borderRadius="l"
        borderWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
      >
        <Box alignItems="center" justifyContent="between" columnGap="m">
          <Box alignItems="center" columnGap="s" minWidth={0}>
            <Text variant="label">Records</Text>
            <Text variant="caption" color="muted" truncate>
              {summary(outcome)}
            </Text>
          </Box>
          <Button
            size="sm"
            variant="ghost"
            aria-expanded={expanded}
            aria-controls={panelId}
            onClick={() => setExpanded((open) => !open)}
          >
            {expanded ? 'Hide' : 'Show'}
          </Button>
        </Box>

        {expanded && (
          <Box id={panelId} flexDirection="column">
            <ReviewTable migrationId={migrationId} />
          </Box>
        )}
      </Box>
    </Box>
  )
}

function summary(
  outcome: ReturnType<typeof useMigrationImportOutcome>,
): string {
  if (outcome.isLoading || outcome.isError) {
    return ''
  }
  const imported = `${importedTotal(outcome.imported)} imported`
  return outcome.remaining > 0
    ? `${imported} · ${outcome.remaining} not imported`
    : imported
}
