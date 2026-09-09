'use client'

import { Alert, Button, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ApprovedResolutionSummary } from './ApprovedResolutionSummary'
import { mockMigration } from './mockData'
import { PrototypeAction, PrototypeState } from './model'
import { Metric, OwnershipSummary, Surface } from './PrototypePrimitives'
import { RecordExplorer } from './RecordExplorer'
import { MigrationTotals, TransferReceipt } from './selectors'

export function GuidedTransferStage({
  state,
  reviewing,
  setReviewing,
  totals,
  problemCount,
  act,
}: {
  state: PrototypeState
  reviewing: boolean
  setReviewing: (value: boolean) => void
  totals: MigrationTotals
  problemCount: number
  act: (action: PrototypeAction) => void
}) {
  return (
    <Surface emphasis={reviewing}>
      <Text variant="heading-xs" as="h3">
        {reviewing ? 'Review irreversible transfer' : 'Choose the clean cohort'}
      </Text>
      {reviewing ? (
        <>
          <ApprovedResolutionSummary
            state={state}
            act={act}
            context="transfer"
          />
          <OwnershipSummary />
          <Alert
            variant="warning"
            title="Stripe is stopped first"
            description="Polar then activates each subscription without charging today. This cannot be automatically undone."
          />
          <Text>
            {totals.clean} clean subscriptions ·{' '}
            {mockMigration.transfer.monthlyValue} monthly value · renewals{' '}
            {mockMigration.transfer.renewalWindow}
          </Text>
          <Box gap="s">
            <Button variant="secondary" onClick={() => setReviewing(false)}>
              Back
            </Button>
            <Button
              onClick={() => {
                setReviewing(false)
                act('transfer')
              }}
            >
              Transfer {totals.clean} subscriptions
            </Button>
          </Box>
        </>
      ) : (
        <>
          <Text color="muted">
            Transfer exactly the {totals.clean} clean records. All{' '}
            {problemCount} problem records stay billed on Stripe.
          </Text>
          <Alert
            variant="info"
            title="Test webhook acknowledged"
            description="Polar cannot verify how your application interprets out-of-order events."
          />
          <Box>
            <Button onClick={() => setReviewing(true)}>Review transfer</Button>
          </Box>
        </>
      )}
    </Surface>
  )
}

export function GuidedReceiptStage({
  state,
  totals,
  problemCount,
  act,
}: {
  state: PrototypeState
  totals: MigrationTotals
  problemCount: number
  act: (action: PrototypeAction) => void
}) {
  const receipt: TransferReceipt | null = state.receipt
  const remaining = receipt?.remainingProblems ?? problemCount

  return (
    <Box flexDirection="column" rowGap="l">
      <Surface>
        <Status
          status={`Completed with ${remaining} exceptions`}
          color="yellow"
        />
        <Text variant="heading-xs" as="h3">
          Review the transfer receipt
        </Text>
        <Box gap="xl" flexWrap="wrap">
          <Metric
            label="Billing on Polar"
            value={receipt?.polarOwned ?? totals.clean}
          />
          <Metric
            label="Billing on Stripe"
            value={receipt?.stripeOwned ?? problemCount}
          />
          <Metric label="Unknown owner" value={receipt?.unknownOwned ?? 0} />
        </Box>
        <ApprovedResolutionSummary state={state} act={act} context="receipt" />
        <Text color="muted">
          All {remaining} problem records remain on Stripe with documented
          reasons.
        </Text>
        <Box gap="s">
          <Button variant="secondary" onClick={() => act('review_receipt')}>
            Export receipt
          </Button>
          <Button onClick={() => act('close')}>
            Close with billing on Stripe
          </Button>
        </Box>
        {state.receiptViewed ? (
          <Text variant="caption" color="success" role="status">
            Mock receipt exported.
          </Text>
        ) : null}
      </Surface>
      <RecordExplorer transferred defaultMode="all" title="Stripe exceptions" />
    </Box>
  )
}
