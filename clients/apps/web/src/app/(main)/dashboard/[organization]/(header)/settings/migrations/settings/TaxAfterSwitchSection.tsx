'use client'

import { Button, Spinner, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useEffect, useEffectEvent, useState } from 'react'
import { BulkTaxChoice, BulkTaxChoiceHint } from '../bulkTax/BulkTaxChoice'
import { applyLabel, formatCount } from '../bulkTax/bulkTaxCopy'
import { BulkTaxProgress } from '../bulkTax/BulkTaxProgress'
import { TaxBehavior, TaxBreakdown } from '../bulkTax/bulkTaxRecords'
import { useBulkTaxUpdate } from '../bulkTax/useBulkTaxUpdate'
import { useTaxBreakdown } from '../bulkTax/useTaxBreakdown'
import type { MigrationSettingsSectionProps } from './migrationSettingsSections'

const affectedCount = (counts: TaxBreakdown, target: TaxBehavior) =>
  counts.undecided +
  (target === 'exclusive' ? counts.inclusive : counts.exclusive)

export function TaxAfterSwitchSection({
  migrationId,
  onBusyChange,
}: MigrationSettingsSectionProps) {
  const breakdown = useTaxBreakdown(migrationId)
  const controller = useBulkTaxUpdate(migrationId)
  const [target, setTarget] = useState<TaxBehavior>('exclusive')
  const notifyBusy = useEffectEvent(onBusyChange)

  useEffect(() => {
    notifyBusy(controller.busy)
  }, [controller.busy])

  const counts = breakdown.data
  if (!counts) {
    return breakdown.isError ? (
      <Text variant="caption" color="error">
        We couldn&apos;t load your subscriptions.
      </Text>
    ) : (
      <Spinner />
    )
  }

  const affected = affectedCount(counts, target)
  return (
    <Box flexDirection="column" rowGap="m">
      <Text variant="caption" color="muted" tabularNums>
        {summary(counts)}
      </Text>
      {controller.state.phase === 'idle' ? (
        <Box flexDirection="column" rowGap="s">
          <Box alignItems="center" justifyContent="between" columnGap="m">
            <BulkTaxChoice value={target} onChange={setTarget} />
            <Button
              size="sm"
              onClick={() => controller.start(target)}
              disabled={affected === 0}
            >
              {affected === 0 ? 'Nothing to change' : applyLabel(target, affected)}
            </Button>
          </Box>
          <BulkTaxChoiceHint value={target} />
        </Box>
      ) : (
        <BulkTaxProgress controller={controller} onDismiss={controller.reset} />
      )}
    </Box>
  )
}

function summary(counts: TaxBreakdown): string {
  const parts = [
    `${formatCount(counts.inclusive)} inclusive`,
    `${formatCount(counts.exclusive)} exclusive`,
  ]
  if (counts.undecided > 0) {
    parts.push(`${formatCount(counts.undecided)} unset on Stripe`)
  }
  if (counts.locked > 0) {
    parts.push(`${formatCount(counts.locked)} already switched`)
  }
  return parts.join(' · ')
}
