'use client'

import { Alert, Button, Grid, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { mockMigration } from './mockData'
import { PrototypeAction, PrototypeStage, PrototypeState } from './model'
import {
  ClosedState,
  DecisionList,
  Metric,
  OwnershipSummary,
  PrototypeLabel,
  Surface,
} from './PrototypePrimitives'

interface Props {
  state: PrototypeState
  act: (action: PrototypeAction) => void
}

export function ControlTowerVariant({ state, act }: Props) {
  if (state.stage === 'closed') {
    return <ClosedState onReset={() => act('reset')} />
  }

  return (
    <Box flexDirection="column" rowGap="xl">
      <PrototypeLabel
        number="B"
        title="Migration control tower"
        description="A persistent operations view. Cohorts, exceptions, and billing ownership stay visible throughout."
      />
      <OwnershipSummary
        polar={state.stage === 'receipt' ? 9 : 0}
        stripe={state.stage === 'receipt' ? 832 : 841}
      />
      <Grid templateColumns={{ base: '1fr', lg: '280px 1fr' }} gap="l">
        <Box flexDirection="column" rowGap="s">
          <TowerQueue
            label="Needs decision"
            value={state.stage === 'decisions' ? 7 : 0}
            active={state.stage === 'decisions'}
          />
          <TowerQueue
            label="Payment methods"
            value={state.stage === 'cards' ? 806 : 0}
            active={state.stage === 'cards'}
          />
          <TowerQueue
            label="Ready to transfer"
            value={state.stage === 'transfer' ? 10 : 0}
            active={state.stage === 'transfer'}
          />
          <TowerQueue
            label="Moved to Polar"
            value={state.stage === 'receipt' ? 9 : 0}
            active={state.stage === 'receipt'}
          />
        </Box>
        <TowerWorkspace stage={state.stage} act={act} />
      </Grid>
    </Box>
  )
}

function TowerQueue({
  label,
  value,
  active,
}: {
  label: string
  value: number
  active: boolean
}) {
  return (
    <Box
      alignItems="center"
      justifyContent="between"
      padding="l"
      borderRadius="m"
      borderWidth={1}
      borderStyle="solid"
      borderColor={active ? 'border-warning' : 'border-secondary'}
      backgroundColor={active ? 'background-warning' : 'background-card'}
    >
      <Text variant="caption">{label}</Text>
      <Text variant="body" tabularNums>
        {value}
      </Text>
    </Box>
  )
}

function TowerWorkspace({
  stage,
  act,
}: {
  stage: PrototypeStage
  act: (action: PrototypeAction) => void
}) {
  if (stage === 'create') {
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

  if (stage === 'assessment') {
    return (
      <Surface>
        <Status status="Source connected" color="green" />
        <Text variant="heading-xs" as="h3">
          Populate the control tower
        </Text>
        <Box gap="xl" flexWrap="wrap">
          <Metric label="Subscriptions" value={841} />
          <Metric label="Products" value={4} />
          <Metric label="Customers" value={829} />
        </Box>
        <Box>
          <Button onClick={() => act('assess')}>Run assessment</Button>
        </Box>
      </Surface>
    )
  }

  if (stage === 'decisions') {
    return (
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
    )
  }

  if (stage === 'cards') {
    return (
      <Surface>
        <Status status="Waiting on Stripe" color="yellow" />
        <Text variant="heading-xs" as="h3">
          Payment-method cohort
        </Text>
        <Box gap="xl" flexWrap="wrap">
          <Metric label="Matching cards" value={806} />
          <Metric label="Customer action" value={6} />
          <Metric label="Unsupported" value={12} />
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

  if (stage === 'transfer') {
    return (
      <Surface emphasis>
        <Text variant="heading-xs" as="h3">
          Ready cohort
        </Text>
        <Text color="muted">
          10 selected · {mockMigration.transfer.monthlyValue} monthly value · no
          renewal inside 24 hours
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
    <Surface>
      <Status status="Known ownership" color="green" />
      <Text variant="heading-xs" as="h3">
        Reconciliation
      </Text>
      <Box gap="xl" flexWrap="wrap">
        <Metric label="Moved" value={9} />
        <Metric label="Left on Stripe" value={1} />
        <Metric label="Unknown" value={0} />
      </Box>
      <Text color="muted">
        The exception renewed too recently. Stripe continues billing it.
      </Text>
      <Box gap="s">
        <Button variant="secondary" onClick={() => act('review_receipt')}>
          Export ledger
        </Button>
        <Button onClick={() => act('close')}>Close program</Button>
      </Box>
    </Surface>
  )
}
