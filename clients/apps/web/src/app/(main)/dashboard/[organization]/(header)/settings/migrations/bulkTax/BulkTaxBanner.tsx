'use client'

import { Alert } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'
import {
  applyLabel,
  BULK_TAX_SCOPE,
  EXCLUSIVE_WARNING,
  subscriptionsLabel,
  TAX_DESCRIPTIONS,
} from './bulkTaxCopy'
import { BulkTaxProgress } from './BulkTaxProgress'
import { TaxBehavior } from './bulkTaxRecords'
import { useBulkTaxUpdate } from './useBulkTaxUpdate'
import { useTaxBreakdown } from './useTaxBreakdown'

export function BulkTaxBanner({ migrationId }: { migrationId: string }) {
  const undecided = useTaxBreakdown(migrationId).data?.undecided ?? 0
  const controller = useBulkTaxUpdate(migrationId)
  const [confirming, setConfirming] = useState<TaxBehavior | null>(null)
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) {
    return null
  }

  if (controller.state.phase !== 'idle') {
    return (
      <Box
        padding="l"
        borderRadius="l"
        borderWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
      >
        <BulkTaxProgress
          controller={controller}
          onDismiss={() => {
            controller.reset()
            setConfirming(null)
          }}
        />
      </Box>
    )
  }

  if (confirming) {
    const run = () => controller.start(confirming)
    return confirming === 'exclusive' ? (
      <Alert
        variant="warning"
        title={`${applyLabel('exclusive')}?`}
        description={`${EXCLUSIVE_WARNING} ${BULK_TAX_SCOPE}`}
        actions={[
          { text: 'Yes, make all exclusive', onClick: run },
          { text: 'Cancel', onClick: () => setConfirming(null) },
        ]}
      />
    ) : (
      <Alert
        variant="info"
        title={`${applyLabel('inclusive')}?`}
        description={`${TAX_DESCRIPTIONS.inclusive} ${BULK_TAX_SCOPE}`}
        actions={[
          { text: 'Yes, make all inclusive', onClick: run },
          { text: 'Cancel', onClick: () => setConfirming(null) },
        ]}
      />
    )
  }

  return (
    <Alert
      variant={undecided > 0 ? 'warning' : 'info'}
      title={
        undecided > 0
          ? `${subscriptionsLabel(undecided)} need a tax decision`
          : 'Subscriptions switch with tax included in the price'
      }
      description={
        undecided > 0
          ? "Stripe doesn't say whether their price includes tax, so they're marked Needs info and would switch as inclusive. Decide for every subscription at once."
          : 'Each subscription defaults to inclusive: the customer keeps paying the listed price and Polar takes tax out of it. Charging tax on top instead? Change them all at once.'
      }
      actions={[
        {
          text: applyLabel('exclusive'),
          onClick: () => setConfirming('exclusive'),
        },
        {
          text: applyLabel('inclusive'),
          onClick: () => setConfirming('inclusive'),
        },
      ]}
      onDismiss={() => setDismissed(true)}
    />
  )
}
