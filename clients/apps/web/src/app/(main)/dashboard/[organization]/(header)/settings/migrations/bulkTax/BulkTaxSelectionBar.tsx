'use client'

import { Button, Modal, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'
import { isRowSelected, SelectionState } from '../selection'
import { isSwitchable } from '../switch/switchRows'
import { ExclusiveWarning } from './BulkTaxChoice'
import {
  subscriptionsLabel,
  TAX_DESCRIPTIONS,
  TAX_LABELS,
  TAX_OPTIONS,
} from './bulkTaxCopy'
import { BulkTaxProgress } from './BulkTaxProgress'
import { TaxBehavior, TaxRow } from './bulkTaxRecords'
import { useBulkTaxUpdate } from './useBulkTaxUpdate'

export function BulkTaxSelectionBar({
  migrationId,
  selection,
  selectedCount,
}: {
  migrationId: string
  selection: SelectionState
  selectedCount: number
}) {
  const controller = useBulkTaxUpdate(migrationId)
  const [target, setTarget] = useState<TaxBehavior | null>(null)
  const { phase } = controller.state
  const selected = subscriptionsLabel(selectedCount)

  const close = () => {
    if (controller.busy) return
    setTarget(null)
    controller.reset()
  }
  const start = (next: TaxBehavior) => {
    // Captured now: the merchant may keep ticking rows while this runs.
    const snapshot = selection
    controller.start(
      next,
      (row: TaxRow) =>
        isSwitchable(row) &&
        row.record_id != null &&
        isRowSelected(snapshot, row.record_id),
    )
  }

  if (selectedCount <= 0 && target === null) {
    return null
  }

  return (
    <>
      <Box
        position="sticky"
        bottom="l"
        zIndex={10}
        alignItems="center"
        justifyContent="between"
        columnGap="l"
        rowGap="s"
        flexWrap="wrap"
        paddingHorizontal="l"
        paddingVertical="m"
        borderRadius="l"
        borderWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
        backgroundColor="background-card"
        boxShadow="l"
      >
        <Text variant="caption">{selected} selected</Text>
        <Box alignItems="center" columnGap="s">
          <Text variant="caption" color="muted">
            Tax after switch
          </Text>
          {TAX_OPTIONS.map((option) => (
            <Button
              key={option.value}
              size="sm"
              variant="secondary"
              onClick={() => setTarget(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </Box>
      </Box>
      <Modal
        title={
          target ? `Make ${selected} ${TAX_LABELS[target].toLowerCase()}?` : ''
        }
        isShown={target !== null}
        hide={close}
        modalContent={
          target ? (
            <Box flexDirection="column" rowGap="l" padding="xl">
              <Text color="muted">
                {TAX_DESCRIPTIONS[target]} Only the selected subscriptions
                change.
              </Text>
              {target === 'exclusive' ? <ExclusiveWarning /> : null}
              <BulkTaxProgress controller={controller} />
              <Box justifyContent="end" columnGap="s">
                <Button
                  variant="ghost"
                  onClick={close}
                  disabled={controller.busy}
                >
                  {phase === 'done' ? 'Close' : 'Cancel'}
                </Button>
                {phase === 'idle' ? (
                  <Button onClick={() => start(target)}>
                    Make {TAX_LABELS[target].toLowerCase()}
                  </Button>
                ) : null}
              </Box>
            </Box>
          ) : (
            <Box />
          )
        }
      />
    </>
  )
}
