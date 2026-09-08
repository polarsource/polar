'use client'

import { Alert, Button, Input, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'
import { mockMigration } from './mockData'
import { PrototypeAction, PrototypeState } from './model'
import {
  ClosedState,
  DecisionList,
  FlowRail,
  Metric,
  OwnershipSummary,
  PrototypeLabel,
  Surface,
} from './PrototypePrimitives'

interface Props {
  state: PrototypeState
  act: (action: PrototypeAction) => void
}

export function GuidedVariant({ state, act }: Props) {
  const [reviewing, setReviewing] = useState(false)

  if (state.stage === 'closed') {
    return <ClosedState onReset={() => act('reset')} />
  }

  return (
    <Box flexDirection="column" rowGap="xl">
      <PrototypeLabel
        number="A"
        title="Guided runbook"
        description="One calm next action at a time. Decisions appear only when they block the current step."
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
            <Text variant="label" as="label">
              Restricted Stripe key
            </Text>
            <Input
              aria-label="Restricted Stripe key"
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
            and payment methods.
          </Text>
          <Box gap="xl" flexWrap="wrap">
            <Metric label="Subscriptions found" value={841} />
            <Metric label="Potentially eligible" value={812} />
            <Metric label="Stay on Stripe" value={22} />
          </Box>
          <Box>
            <Button onClick={() => act('assess')}>Run assessment</Button>
          </Box>
        </Surface>
      ) : null}
      {state.stage === 'decisions' ? (
        <Surface>
          <Text variant="heading-xs" as="h3">
            Resolve 7 decisions
          </Text>
          <Text color="muted">
            These choices prevent duplicate products, incorrect customer
            matches, and unexpected tax treatment.
          </Text>
          <DecisionList />
          <Alert
            variant="info"
            title="22 subscriptions will stay on Stripe"
            description="They remain billed there with a documented reason."
          />
          <Box>
            <Button onClick={() => act('resolve')}>
              Confirm decisions and prepare
            </Button>
          </Box>
        </Surface>
      ) : null}
      {state.stage === 'cards' ? (
        <Surface>
          <Status status="Waiting on Stripe" color="yellow" size="small" />
          <Text variant="heading-xs" as="h3">
            Move saved payment methods
          </Text>
          <Text color="muted">
            Stripe copied 806 matching cards. Six customers need to add a card
            again.
          </Text>
          <Alert
            variant="warning"
            title="A copied card is not a successful payment"
            description="Its chargeability is confirmed at the first real renewal."
          />
          <Box>
            <Button onClick={() => act('copy_cards')}>
              Mark card copy complete
            </Button>
          </Box>
        </Surface>
      ) : null}
      {state.stage === 'transfer' ? (
        <Surface emphasis={reviewing}>
          <Text variant="heading-xs" as="h3">
            {reviewing ? 'Review irreversible transfer' : 'Choose a canary'}
          </Text>
          {reviewing ? (
            <>
              <OwnershipSummary />
              <Alert
                variant="warning"
                title="Stripe is stopped first"
                description="Polar then activates each subscription without charging today. This cannot be automatically undone."
              />
              <Text>
                10 subscriptions · {mockMigration.transfer.monthlyValue} monthly
                value · renewals {mockMigration.transfer.renewalWindow}
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
                  Transfer 10 subscriptions
                </Button>
              </Box>
            </>
          ) : (
            <>
              <Text color="muted">
                Start with ten known customers. All have explicit mappings,
                matching cards, and renew outside 24 hours.
              </Text>
              <Alert
                variant="info"
                title="Test webhook acknowledged"
                description="Polar cannot verify how your application interprets out-of-order events."
              />
              <Box>
                <Button onClick={() => setReviewing(true)}>
                  Review transfer
                </Button>
              </Box>
            </>
          )}
        </Surface>
      ) : null}
      {state.stage === 'receipt' ? (
        <Surface>
          <Status status="Completed with 1 exception" color="yellow" />
          <Text variant="heading-xs" as="h3">
            Review the transfer receipt
          </Text>
          <Box gap="xl" flexWrap="wrap">
            <Metric label="Billing on Polar" value={9} />
            <Metric label="Billing on Stripe" value={1} />
            <Metric label="Needs recovery" value={0} />
          </Box>
          <Text color="muted">
            One subscription renewed too recently and remains on Stripe.
          </Text>
          <Box gap="s">
            <Button variant="secondary" onClick={() => act('review_receipt')}>
              Export receipt
            </Button>
            <Button onClick={() => act('close')}>
              Close with billing on Stripe
            </Button>
          </Box>
        </Surface>
      ) : null}
    </Box>
  )
}
