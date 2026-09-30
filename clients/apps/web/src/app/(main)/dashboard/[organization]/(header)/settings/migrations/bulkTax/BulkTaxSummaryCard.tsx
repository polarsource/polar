'use client'

import { Button, Spinner, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'
import { BulkTaxChoice } from './BulkTaxChoice'
import { applyLabel, formatCount, subscriptionsLabel } from './bulkTaxCopy'
import { BulkTaxProgress, BulkTaxProgressBar } from './BulkTaxProgress'
import { TaxBehavior } from './bulkTaxRecords'
import { useBulkTaxUpdate } from './useBulkTaxUpdate'
import { useTaxBreakdown } from './useTaxBreakdown'

export function BulkTaxSummaryCard({ migrationId }: { migrationId: string }) {
  const breakdown = useTaxBreakdown(migrationId)
  const controller = useBulkTaxUpdate(migrationId)
  const [target, setTarget] = useState<TaxBehavior>('exclusive')
  const [editing, setEditing] = useState(false)
  const { phase } = controller.state
  const counts = breakdown.data
  const editable = counts
    ? counts.inclusive + counts.exclusive + counts.undecided
    : 0
  const toChange = counts
    ? counts.undecided +
      (target === 'exclusive' ? counts.inclusive : counts.exclusive)
    : 0

  return (
    <Box
      flexDirection="column"
      rowGap="l"
      padding="xl"
      borderRadius="l"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      backgroundColor="background-card"
    >
      <Box justifyContent="between" alignItems="start" columnGap="l">
        <Box flexDirection="column" rowGap="xs">
          <Text variant="heading-xs" as="h3">
            Tax after switch
          </Text>
          <Text variant="caption" color="muted">
            How Polar charges tax once these subscriptions switch.
          </Text>
        </Box>
        {!editing && phase === 'idle' ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setEditing(true)}
          >
            Change for all
          </Button>
        ) : null}
      </Box>

      {counts === undefined ? (
        <Spinner />
      ) : (
        <Box flexDirection="column" rowGap="s">
          <Box columnGap="xl" rowGap="s" flexWrap="wrap">
            <Stat label="Inclusive" value={counts.inclusive} />
            <Stat label="Exclusive" value={counts.exclusive} />
            <Stat label="Unset on Stripe" value={counts.undecided} warning />
            <Stat label="Switched, locked" value={counts.locked} muted />
          </Box>
          <BulkTaxProgressBar done={counts.exclusive} total={editable} />
          <Text variant="caption" color="muted">
            {formatCount(counts.exclusive)} of {subscriptionsLabel(editable)}{' '}
            add tax on top of the price.
          </Text>
        </Box>
      )}

      {phase !== 'idle' ? (
        <BulkTaxProgress
          controller={controller}
          onDismiss={() => {
            controller.reset()
            setEditing(false)
          }}
        />
      ) : editing ? (
        <Box flexDirection="column" rowGap="m">
          <Box height={1} backgroundColor="background-secondary" />
          <BulkTaxChoice value={target} onChange={setTarget} />
          <Box justifyContent="end" columnGap="s">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => controller.start(target)}
              disabled={toChange === 0}
            >
              {toChange === 0
                ? 'Nothing to change'
                : applyLabel(target, toChange)}
            </Button>
          </Box>
        </Box>
      ) : null}
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
