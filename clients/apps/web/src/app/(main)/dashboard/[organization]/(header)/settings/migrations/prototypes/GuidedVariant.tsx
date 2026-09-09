'use client'

import { Alert, Button, Input, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'
import { mockMigration } from './mockData'
import { PrototypeAction, PrototypeState } from './model'
import { CustomerActionList, ProblemPackages } from './ProblemPackages'
import {
  ClosedState,
  DecisionList,
  FlowRail,
  Metric,
  PrototypeLabel,
  Surface,
} from './PrototypePrimitives'
import { RecordExplorer } from './RecordExplorer'
import { GuidedReceiptStage, GuidedTransferStage } from './GuidedLaterStages'
import { getInitialTotals, getProblemSubscriptions } from './selectors'

interface Props {
  state: PrototypeState
  act: (action: PrototypeAction) => void
}

export function GuidedVariant({ state, act }: Props) {
  const [reviewing, setReviewing] = useState(false)
  const totals = getInitialTotals()
  const problems = getProblemSubscriptions()

  if (state.stage === 'closed') {
    return <ClosedState onReset={() => act('reset')} />
  }

  return (
    <Box flexDirection="column" rowGap="xl">
      <PrototypeLabel
        number="A"
        title="Guided runbook"
        description="One action at a time. Decisions appear only when they block the current step."
      />
      <FlowRail stage={state.stage} />
      {state.stage === 'create' ? (
        <Surface>
          <Status status="Step 1 of 6" color="blue" size="small" />
          <Text variant="heading-xs" as="h3">
            Connect your Stripe account
          </Text>
          <Text color="muted">
            Polar reads your catalog and subscription state. Nothing changes in
            Stripe during assessment.
          </Text>
          <Box flexDirection="column" rowGap="s">
            <Text variant="label" as="label" htmlFor="prototype-stripe-key">
              Restricted Stripe key
            </Text>
            <Input
              id="prototype-stripe-key"
              type="password"
              defaultValue="rk_live_mock_pepy"
            />
          </Box>
          <Box>
            <Button onClick={() => act('create')}>Validate and connect</Button>
          </Box>
        </Surface>
      ) : null}
      {state.stage === 'assessment' ? (
        <Surface>
          <Status status="Stripe connected" color="green" size="small" />
          <Text variant="heading-xs" as="h3">
            Assess what can move
          </Text>
          <Text color="muted">
            Polar checks products, customers, subscriptions, tax information,
            and payment methods against the shared catalog.
          </Text>
          <Box gap="xl" flexWrap="wrap">
            <Metric label="Subscriptions found" value={totals.total} />
            <Metric label="Ready to transfer" value={totals.clean} />
            <Metric label="With problems" value={totals.problems} />
          </Box>
          <Box>
            <Button onClick={() => act('assess')}>Run assessment</Button>
          </Box>
        </Surface>
      ) : null}
      {state.stage === 'decisions' ? (
        <Box flexDirection="column" rowGap="l">
          <Surface>
            <Text variant="heading-xs" as="h3">
              Review problem categories
            </Text>
            <Text color="muted">
              Confirm merchant mappings, then keep the {problems.length} problem
              records on Stripe until each package is cleared.
            </Text>
            <DecisionList />
            <ProblemPackages />
            <Alert
              variant="info"
              title={`${problems.length} subscriptions stay on Stripe`}
              description="Missing country, existing Polar product, and identity conflict lead the review. Open the catalog for every package."
            />
            <Box>
              <Button onClick={() => act('resolve')}>
                Confirm decisions and prepare
              </Button>
            </Box>
          </Surface>
          <RecordExplorer title="Problem records" />
        </Box>
      ) : null}
      {state.stage === 'cards' ? (
        <Surface>
          <Status status="Waiting on Stripe" color="yellow" size="small" />
          <Text variant="heading-xs" as="h3">
            Move saved payment methods
          </Text>
          <Text color="muted">
            Stripe can copy {mockMigration.cards.matching} matching cards.{' '}
            {mockMigration.cards.customerAction} customers need a card action
            before they leave Stripe.
          </Text>
          <CustomerActionList />
          <Alert
            variant="warning"
            title="A copied card is not a successful payment"
            description="Chargeability is confirmed at the first real renewal."
          />
          <Box>
            <Button onClick={() => act('copy_cards')}>
              Mark card copy complete
            </Button>
          </Box>
        </Surface>
      ) : null}
      {state.stage === 'transfer' ? (
        <GuidedTransferStage
          reviewing={reviewing}
          setReviewing={setReviewing}
          totals={totals}
          problemCount={problems.length}
          act={act}
        />
      ) : null}
      {state.stage === 'receipt' ? (
        <GuidedReceiptStage
          state={state}
          totals={totals}
          problemCount={problems.length}
          act={act}
        />
      ) : null}
    </Box>
  )
}
