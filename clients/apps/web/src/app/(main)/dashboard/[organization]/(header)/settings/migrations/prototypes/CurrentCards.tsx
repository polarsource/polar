'use client'

import { Alert, Button, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ApprovedResolutionSummary } from './ApprovedResolutionSummary'
import { mockMigration } from './mockData'
import { PrototypeAction, PrototypeState } from './model'
import { CustomerActionList } from './ProblemPackages'
import { Metric, Surface } from './PrototypePrimitives'

const CHECKLIST: {
  title: string
  owner: 'You' | 'Polar' | 'Stripe'
  state: 'done' | 'current' | 'upcoming'
}[] = [
  { title: 'Get the Polar account ID', owner: 'Polar', state: 'done' },
  { title: 'Start the copy in Stripe', owner: 'You', state: 'done' },
  { title: 'Polar accepts the copy', owner: 'Polar', state: 'done' },
  { title: 'Stripe copies the cards', owner: 'Stripe', state: 'done' },
  { title: 'Polar checks the cards', owner: 'Polar', state: 'current' },
  {
    title: 'Handle customers without a card',
    owner: 'You',
    state: 'upcoming',
  },
]

export function CurrentCards({
  state,
  act,
}: {
  state: PrototypeState
  act: (action: PrototypeAction) => void
}) {
  const done = CHECKLIST.filter((step) => step.state === 'done').length

  return (
    <Box flexDirection="column" rowGap="l">
      <Box flexDirection="column" rowGap="xs">
        <Text variant="heading-xs" as="h3">
          Move saved cards
        </Text>
        <Text variant="caption" color="muted">
          Follow the checklist to move your customers&apos; saved cards onto
          Polar. {done} of {CHECKLIST.length} complete.
        </Text>
      </Box>

      <Box gap="xl" flexWrap="wrap">
        <Metric label="Matching cards" value={mockMigration.cards.matching} />
        <Metric
          label="Customer actions"
          value={mockMigration.cards.customerAction}
        />
      </Box>

      <ApprovedResolutionSummary
        state={state}
        act={act}
        compact
        context="cards"
      />

      <Box as="ol" flexDirection="column" rowGap="m">
        {CHECKLIST.map((step) => (
          <Box
            as="li"
            key={step.title}
            alignItems="start"
            columnGap="m"
            aria-current={step.state === 'current' ? 'step' : undefined}
          >
            <Box flex={1} minWidth={0} flexDirection="column" rowGap="xs">
              <Box alignItems="center" columnGap="s" flexWrap="wrap">
                <Text
                  variant="body"
                  color={
                    step.state === 'upcoming'
                      ? 'muted'
                      : step.state === 'current'
                        ? 'default'
                        : 'muted'
                  }
                >
                  {step.title}
                </Text>
                <Status status={step.owner} color="gray" size="small" />
                <Status
                  status={
                    step.state === 'done'
                      ? 'Done'
                      : step.state === 'current'
                        ? 'Now'
                        : 'Later'
                  }
                  color={
                    step.state === 'done'
                      ? 'green'
                      : step.state === 'current'
                        ? 'blue'
                        : 'gray'
                  }
                  size="small"
                />
              </Box>
            </Box>
          </Box>
        ))}
      </Box>

      <Surface>
        <Text variant="heading-xs" as="h3">
          Customers that still need a card action
        </Text>
        <Text variant="caption" color="muted">
          Problematic payment records stay visible. Matching cards do not prove
          chargeability.
        </Text>
        <CustomerActionList />
        <Alert
          variant="warning"
          title="A copied card is not a successful payment"
          description="Chargeability is confirmed at the first real renewal."
        />
        <Box>
          <Button onClick={() => act('copy_cards')}>
            Mark card movement complete
          </Button>
        </Box>
      </Surface>
    </Box>
  )
}
