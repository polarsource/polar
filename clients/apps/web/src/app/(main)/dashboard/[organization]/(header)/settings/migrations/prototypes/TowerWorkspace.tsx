'use client'

import { Alert, Button, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { mockMigration } from './mockData'
import { PrototypeAction, PrototypeState } from './model'
import { DecisionList, Metric, Surface } from './PrototypePrimitives'
import { RecordExplorer } from './RecordExplorer'
import {
  getCleanSubscriptions,
  getInitialTotals,
  getProblemSubscriptions,
} from './selectors'

interface Props {
  state: PrototypeState
  act: (action: PrototypeAction) => void
}

export function TowerWorkspace({ state, act }: Props) {
  const totals = getInitialTotals()
  const problems = getProblemSubscriptions()
  const clean = getCleanSubscriptions().length
  const receipt = state.receipt
  const holds = problems.filter((r) => r.status === 'cutover_hold').length

  if (state.stage === 'create') {
    return (
      <Surface>
        <Status status="No source connected" color="gray" />
        <Text variant="heading-xs" as="h3">
          Connect a billing source
        </Text>
        <Text color="muted">
          Add Stripe to populate the tower with readiness cohorts and
          exceptions.
        </Text>
        <Box>
          <Button onClick={() => act('create')}>Connect mock Stripe</Button>
        </Box>
      </Surface>
    )
  }

  if (state.stage === 'assessment') {
    return (
      <Surface>
        <Status status="Source connected" color="green" />
        <Text variant="heading-xs" as="h3">
          Populate the control tower
        </Text>
        <Box gap="xl" flexWrap="wrap">
          <Metric label="Subscriptions" value={totals.total} />
          <Metric label="Ready" value={totals.clean} />
          <Metric label="Problems" value={totals.problems} />
        </Box>
        <Box>
          <Button onClick={() => act('assess')}>Run assessment</Button>
        </Box>
      </Surface>
    )
  }

  if (state.stage === 'decisions') {
    return (
      <Box flexDirection="column" rowGap="l">
        <Surface emphasis>
          <Text variant="heading-xs" as="h3">
            Decision inbox
          </Text>
          <DecisionList />
          <Box>
            <Button onClick={() => act('resolve')}>
              Resolve all demonstrated decisions
            </Button>
          </Box>
        </Surface>
        <RecordExplorer title="Exception inbox" />
      </Box>
    )
  }

  if (state.stage === 'cards') {
    return (
      <Surface>
        <Status status="Waiting on Stripe" color="yellow" />
        <Text variant="heading-xs" as="h3">
          Payment-method cohort
        </Text>
        <Box gap="xl" flexWrap="wrap">
          <Metric label="Matching cards" value={mockMigration.cards.matching} />
          <Metric
            label="Customer action"
            value={mockMigration.cards.customerAction}
          />
          <Metric label="Problem holds" value={holds} />
        </Box>
        <Alert
          variant="warning"
          title="Matching does not prove chargeability"
        />
        <Box>
          <Button onClick={() => act('copy_cards')}>
            Complete mocked card transfer
          </Button>
        </Box>
      </Surface>
    )
  }

  if (state.stage === 'transfer') {
    return (
      <Surface emphasis>
        <Text variant="heading-xs" as="h3">
          Ready cohort
        </Text>
        <Text color="muted">
          {clean} selected · {mockMigration.transfer.monthlyValue} monthly value
          · no renewal inside 24 hours
        </Text>
        <Alert
          variant="warning"
          title="Stripe is stopped before Polar activates"
          description="Transfer is per subscription and cannot be automatically undone."
        />
        <Box>
          <Button onClick={() => act('transfer')}>Transfer ready cohort</Button>
        </Box>
      </Surface>
    )
  }

  return (
    <Box flexDirection="column" rowGap="l">
      <Surface>
        <Status status="Known ownership" color="green" />
        <Text variant="heading-xs" as="h3">
          Reconciliation
        </Text>
        <Box gap="xl" flexWrap="wrap">
          <Metric label="Moved" value={receipt?.moved ?? clean} />
          <Metric
            label="Left on Stripe"
            value={receipt?.stripeOwned ?? problems.length}
          />
          <Metric label="Unknown" value={receipt?.unknownOwned ?? 0} />
        </Box>
        <Box gap="s">
          <Button variant="secondary" onClick={() => act('review_receipt')}>
            Export ledger
          </Button>
          <Button onClick={() => act('close')}>Close program</Button>
        </Box>
        {state.receiptViewed ? (
          <Text variant="caption" color="success" role="status">
            Mock ledger exported.
          </Text>
        ) : null}
      </Surface>
      <RecordExplorer
        transferred
        defaultMode="all"
        title="Exception reconciliation"
      />
    </Box>
  )
}
