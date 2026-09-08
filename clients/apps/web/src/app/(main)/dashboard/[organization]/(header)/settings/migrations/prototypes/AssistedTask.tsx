'use client'

import { Alert, Button, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { mockMigration } from './mockData'
import { PrototypeAction, PrototypeState } from './model'
import { CustomerActionList, ProblemPackages } from './ProblemPackages'
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

export function AssistedTask({ state, act }: Props) {
  const totals = getInitialTotals()
  const problems = getProblemSubscriptions()
  const clean = getCleanSubscriptions().length
  const receipt = state.receipt

  if (state.stage === 'create') {
    return (
      <Surface>
        <Status status="Action for you" color="blue" />
        <Text variant="heading-xs" as="h3">
          Share access to Stripe
        </Text>
        <Text color="muted">
          Polar will validate the key, assess the account, and return with a
          migration plan.
        </Text>
        <Box>
          <Button onClick={() => act('create')}>Share mock access</Button>
        </Box>
      </Surface>
    )
  }

  if (state.stage === 'assessment') {
    return (
      <Surface>
        <Status status="Polar is working" color="purple" />
        <Text variant="heading-xs" as="h3">
          We are preparing your migration plan
        </Text>
        <Text color="muted">
          {totals.total} subscriptions discovered · {totals.clean} ready ·{' '}
          {totals.problems} exceptions. This prototype completes assessment
          immediately.
        </Text>
        <Box>
          <Button onClick={() => act('assess')}>View prepared plan</Button>
        </Box>
      </Surface>
    )
  }

  if (state.stage === 'decisions') {
    return (
      <Box flexDirection="column" rowGap="l">
        <Surface emphasis>
          <Status
            status={`${mockMigration.decisions.length} approvals for you`}
            color="yellow"
          />
          <Text variant="heading-xs" as="h3">
            Approve Polar&apos;s proposed plan
          </Text>
          <DecisionList />
          <ProblemPackages />
          <Box>
            <Button onClick={() => act('resolve')}>
              Approve plan and let Polar prepare
            </Button>
          </Box>
        </Surface>
        <RecordExplorer title="Exception groups" />
      </Box>
    )
  }

  if (state.stage === 'cards') {
    return (
      <Surface>
        <Status status="Action for you" color="blue" />
        <Text variant="heading-xs" as="h3">
          Start the card copy in Stripe
        </Text>
        <Text color="muted">
          Polar prepared the mapping. Approve the Stripe copy, then handle these
          external customer actions before later transfers.
        </Text>
        <CustomerActionList />
        <Alert
          variant="info"
          title="Polar owns the next step after approval"
          description="You can leave and return while Stripe processes the request."
        />
        <Box>
          <Button onClick={() => act('copy_cards')}>
            I approved the mock copy
          </Button>
        </Box>
      </Surface>
    )
  }

  if (state.stage === 'transfer') {
    return (
      <Surface emphasis>
        <Status status="Approval required" color="yellow" />
        <Text variant="heading-xs" as="h3">
          Approve the first transfer
        </Text>
        <Box gap="xl" flexWrap="wrap">
          <Metric label="Subscriptions" value={clean} />
          <Metric
            label="Monthly value"
            value={mockMigration.transfer.monthlyValue}
          />
          <Metric label="Exceptions held" value={problems.length} />
        </Box>
        <Alert
          variant="warning"
          title="Stripe cancellation cannot be automatically undone"
          description="Polar will operate and reconcile every selected subscription."
        />
        <Box>
          <Button onClick={() => act('transfer')}>
            Approve canary transfer
          </Button>
        </Box>
      </Surface>
    )
  }

  return (
    <Box flexDirection="column" rowGap="l">
      <Surface>
        <Status status="Review requested" color="blue" />
        <Text variant="heading-xs" as="h3">
          Polar completed the canary
        </Text>
        <Box gap="xl" flexWrap="wrap">
          <Metric
            label="Billing on Polar"
            value={receipt?.polarOwned ?? clean}
          />
          <Metric
            label="Billing on Stripe"
            value={receipt?.stripeOwned ?? problems.length}
          />
          <Metric label="Unknown owner" value={receipt?.unknownOwned ?? 0} />
        </Box>
        <Text color="muted">
          Polar transferred {receipt?.moved ?? clean} clean subscriptions and
          retained all {receipt?.remainingProblems ?? problems.length} problem
          records on Stripe.
        </Text>
        <Box gap="s">
          <Button variant="secondary" onClick={() => act('review_receipt')}>
            Download Polar&apos;s receipt
          </Button>
          <Button onClick={() => act('close')}>Accept and close plan</Button>
        </Box>
        {state.receiptViewed ? (
          <Text variant="caption" color="success" role="status">
            Mock receipt downloaded.
          </Text>
        ) : null}
      </Surface>
      <RecordExplorer
        transferred
        defaultMode="all"
        title="Retained Stripe exceptions"
      />
    </Box>
  )
}
