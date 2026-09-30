'use client'

import { Button, Modal, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'
import { BulkTaxChoice } from './BulkTaxChoice'
import { applyLabel, BULK_TAX_SCOPE } from './bulkTaxCopy'
import { BulkTaxProgress } from './BulkTaxProgress'
import { TaxBehavior } from './bulkTaxRecords'
import { useBulkTaxUpdate } from './useBulkTaxUpdate'

export function BulkTaxToolbarButton({
  migrationId,
  disabled = false,
}: {
  migrationId: string
  disabled?: boolean
}) {
  const controller = useBulkTaxUpdate(migrationId)
  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState<TaxBehavior>('exclusive')
  const { phase } = controller.state

  const close = () => {
    if (controller.busy) return
    setOpen(false)
    controller.reset()
  }

  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        Set tax for all
      </Button>
      <Modal
        title="Set tax for all subscriptions"
        isShown={open}
        hide={close}
        modalContent={
          <Box flexDirection="column" rowGap="l" padding="xl">
            <Text color="muted">{BULK_TAX_SCOPE}</Text>
            {phase === 'idle' ? (
              <BulkTaxChoice value={target} onChange={setTarget} />
            ) : (
              <BulkTaxProgress controller={controller} />
            )}
            <Box justifyContent="end" columnGap="s">
              <Button
                variant="ghost"
                onClick={close}
                disabled={controller.busy}
              >
                {phase === 'done' ? 'Close' : 'Cancel'}
              </Button>
              {phase === 'idle' ? (
                <Button onClick={() => controller.start(target)}>
                  {applyLabel(target)}
                </Button>
              ) : null}
            </Box>
          </Box>
        }
      />
    </>
  )
}
