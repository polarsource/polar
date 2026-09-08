'use client'

import { Alert, Button, Grid, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { mockMigration } from './mockData'
import { PrototypeAction, PrototypeState, stageIndex } from './model'
import {
  ClosedState,
  Metric,
  PrototypeLabel,
  Surface,
} from './PrototypePrimitives'

interface Props {
  state: PrototypeState
  act: (action: PrototypeAction) => void
}

export function AssistedVariant({ state, act }: Props) {
  if (state.stage === 'closed') {
    return <ClosedState onReset={() => act('reset')} />
  }

  return (
    <Box flexDirection="column" rowGap="xl">
      <PrototypeLabel
        number="C"
        title="Polar-assisted migration"
        description="Polar operates the plan. The merchant receives a focused inbox of approvals and external tasks."
      />
      <Grid templateColumns={{ base: '1fr', lg: '1fr 300px' }} gap="l">
        <AssistedTask state={state} act={act} />
        <ActivityTimeline state={state} />
      </Grid>
    </Box>
  )
}

function AssistedTask({ state, act }: Props) {
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
          841 subscriptions discovered. This prototype completes the assessment
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
      <Surface emphasis>
        <Status status="3 approvals for you" color="yellow" />
        <Text variant="heading-xs" as="h3">
          Approve Polar&apos;s proposed plan
        </Text>
        {mockMigration.decisions.map((decision) => (
          <Box
            key={decision.title}
            flexDirection="column"
            rowGap="xs"
            padding="l"
            borderRadius="m"
            backgroundColor="background-secondary"
          >
            <Text variant="body">{decision.title}</Text>
            <Text variant="caption" color="muted">
              {decision.detail}
            </Text>
          </Box>
        ))}
        <Box>
          <Button onClick={() => act('resolve')}>
            Approve plan and let Polar prepare
          </Button>
        </Box>
      </Surface>
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
          Polar has prepared the customer mapping. Stripe needs the account
          owner to approve the copy.
        </Text>
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
          <Metric label="Subscriptions" value={10} />
          <Metric
            label="Monthly value"
            value={mockMigration.transfer.monthlyValue}
          />
          <Metric label="Unknown owner" value={0} />
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
    <Surface>
      <Status status="Review requested" color="blue" />
      <Text variant="heading-xs" as="h3">
        Polar completed the canary
      </Text>
      <Box gap="xl" flexWrap="wrap">
        <Metric label="Billing on Polar" value={9} />
        <Metric label="Billing on Stripe" value={1} />
        <Metric label="Needs recovery" value={0} />
      </Box>
      <Text color="muted">
        Polar reviewed the exception. Stripe still bills it because it renewed
        too recently.
      </Text>
      <Box gap="s">
        <Button variant="secondary" onClick={() => act('review_receipt')}>
          Download Polar&apos;s receipt
        </Button>
        <Button onClick={() => act('close')}>Accept and close plan</Button>
      </Box>
    </Surface>
  )
}

function ActivityTimeline({ state }: { state: PrototypeState }) {
  const completed = stageIndex(state.stage)
  const items = [
    'Stripe access received',
    'Account assessed',
    'Plan approved',
    'Cards copied',
    'Canary transferred',
    'Receipt reviewed',
  ]
  return (
    <Surface>
      <Text variant="heading-xs" as="h3">
        Activity
      </Text>
      <Box as="ol" flexDirection="column" rowGap="m">
        {items.map((item, index) => (
          <Box as="li" key={item} alignItems="center" columnGap="s">
            <Status
              status={
                index < completed
                  ? 'Done'
                  : index === completed
                    ? 'Now'
                    : 'Later'
              }
              color={
                index < completed
                  ? 'green'
                  : index === completed
                    ? 'blue'
                    : 'gray'
              }
              size="small"
            />
            <Text
              variant="caption"
              color={index <= completed ? 'default' : 'muted'}
            >
              {item}
            </Text>
          </Box>
        ))}
      </Box>
    </Surface>
  )
}
