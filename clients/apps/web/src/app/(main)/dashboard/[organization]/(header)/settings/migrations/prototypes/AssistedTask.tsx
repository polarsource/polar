'use client'

import { Alert, Button, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { mockMigration } from './mockData'
import {
  getResolutionCompletionCount,
  isResolutionComplete,
  PrototypeAction,
  PrototypeState,
  RESOLUTION_DOMAINS,
} from './model'
import { CustomerActionList, ProblemPackages } from './ProblemPackages'
import { Metric, Surface } from './PrototypePrimitives'
import { RecordExplorer } from './RecordExplorer'
import { ResolutionResolvers } from './ResolutionResolvers'
import {
  getCleanSubscriptions,
  getInitialTotals,
  getProblemSubscriptions,
} from './selectors'

interface Props {
  state: PrototypeState
  act: (action: PrototypeAction) => void
}

function assistedApproveLabel(resolved: number, total: number): string {
  const remaining = total - resolved
  if (remaining <= 0) {
    return 'Approve plan and let Polar prepare'
  }
  if (remaining === total) {
    return `Choose all ${total} resolutions to approve`
  }
  return `Choose ${remaining} more resolution${remaining === 1 ? '' : 's'} to approve`
}

export function AssistedTask({ state, act }: Props) {
  const totals = getInitialTotals()
  const problems = getProblemSubscriptions()
  const clean = getCleanSubscriptions().length
  const receipt = state.receipt
  const resolvedCount = getResolutionCompletionCount(state.resolutions)
  const resolutionsComplete = isResolutionComplete(state.resolutions)
  const resolutionTotal = RESOLUTION_DOMAINS.length

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
            status={
              resolutionsComplete
                ? 'Ready to approve'
                : `${resolvedCount} of ${resolutionTotal} choices made`
            }
            color={resolutionsComplete ? 'green' : 'yellow'}
          />
          <Text variant="heading-xs" as="h3">
            Approve Polar&apos;s proposed plan
          </Text>
          <Text color="muted">
            Polar suggests a resolution for each blocking decision. Your
            selection becomes the merchant-approved choice and sets what Polar
            prepares versus what stays on Stripe.
          </Text>
          <ResolutionResolvers
            state={state}
            act={act}
            presentation="assisted"
          />
          <Alert
            variant="info"
            title="Suggestions vs your approved choices"
            description="Each card starts as a Polar proposal. Changing an option updates the approved plan consequence before you continue."
          />
          <Box flexDirection="column" rowGap="s">
            <Text variant="heading-xs" as="h3">
              Exception summary
            </Text>
            <Text color="muted">
              Packages below stay visible as context. They are not separate
              approvals — the three choices above decide the plan.
            </Text>
            <ProblemPackages />
          </Box>
          <Box>
            <Button
              disabled={!resolutionsComplete}
              onClick={() => act('resolve')}
            >
              {assistedApproveLabel(resolvedCount, resolutionTotal)}
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
