'use client'

import { Button, Spinner, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useEffect, useEffectEvent, useState } from 'react'
import { BulkTaxChoice } from '../bulkTax/BulkTaxChoice'
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
    <Box flexDirection="column" rowGap="l">
      <Box columnGap="xl" rowGap="s" flexWrap="wrap">
        <Stat label="Inclusive" value={counts.inclusive} />
        <Stat label="Exclusive" value={counts.exclusive} />
        <Stat label="Unset on Stripe" value={counts.undecided} warning />
        <Stat label="Switched, locked" value={counts.locked} muted />
      </Box>

      {controller.state.phase === 'idle' ? (
        <>
          <BulkTaxChoice value={target} onChange={setTarget} />
          <Box justifyContent="end">
            <Button
              size="sm"
              onClick={() => controller.start(target)}
              disabled={affected === 0}
            >
              {affected === 0
                ? `Every subscription is ${target}`
                : applyLabel(target, affected)}
            </Button>
          </Box>
        </>
      ) : (
        <BulkTaxProgress controller={controller} onDismiss={controller.reset} />
      )}
    </Box>
  )
}

function Stat({
  label,
  value,
  muted = false,
  warning = false,
}: {
  label: string
  value: number
  muted?: boolean
  warning?: boolean
}) {
  return (
    <Box flexDirection="column">
      <Text variant="caption" color="muted">
        {label}
      </Text>
      <Text
        variant="heading-xs"
        tabularNums
        color={warning && value > 0 ? 'warning' : muted ? 'muted' : 'default'}
      >
        {formatCount(value)}
      </Text>
    </Box>
  )
}
