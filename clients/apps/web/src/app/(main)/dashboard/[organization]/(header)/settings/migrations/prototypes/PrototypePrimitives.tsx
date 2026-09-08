import { Button, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ReactNode } from 'react'
import { flowSteps, mockMigration } from './mockData'
import { PrototypeStage, stageIndex } from './model'

export function Surface({
  children,
  emphasis = false,
}: {
  children: ReactNode
  emphasis?: boolean
}) {
  return (
    <Box
      flexDirection="column"
      rowGap="l"
      padding="xl"
      borderRadius="l"
      borderWidth={1}
      borderStyle="solid"
      borderColor={emphasis ? 'border-warning' : 'border-primary'}
      backgroundColor={emphasis ? 'background-warning' : 'background-card'}
    >
      {children}
    </Box>
  )
}

export function FlowRail({ stage }: { stage: PrototypeStage }) {
  const activeIndex = stageIndex(stage)
  return (
    <Box as="ol" columnGap="s" alignItems="stretch">
      {flowSteps.map((label, index) => {
        const reached = index <= activeIndex
        const current = index === activeIndex
        return (
          <Box
            as="li"
            key={label}
            flex={1}
            minWidth={0}
            flexDirection="column"
            rowGap="s"
            paddingTop="s"
            borderTopWidth={2}
            borderStyle="solid"
            borderColor={reached ? 'border-primary' : 'border-secondary'}
            aria-current={current ? 'step' : undefined}
          >
            <Text
              variant="caption"
              color={current ? 'default' : 'muted'}
              truncate
            >
              {label}
            </Text>
          </Box>
        )
      })}
    </Box>
  )
}

export function OwnershipSummary({
  polar = mockMigration.subscriptions.polar,
  stripe = mockMigration.subscriptions.total,
}: {
  polar?: number
  stripe?: number
}) {
  return (
    <Box
      gap="l"
      flexWrap="wrap"
      padding="l"
      borderRadius="m"
      backgroundColor="background-secondary"
    >
      <Metric label="Billing on Polar" value={polar} />
      <Metric label="Billing on Stripe" value={stripe} />
      <Metric label="Unknown owner" value={0} />
    </Box>
  )
}

export function Metric({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <Box flexDirection="column" rowGap="xs" minWidth={120}>
      <Text variant="heading-xs" tabularNums>
        {value}
      </Text>
      <Text variant="caption" color="muted">
        {label}
      </Text>
    </Box>
  )
}

export function DecisionList() {
  return (
    <Box flexDirection="column" rowGap="s">
      {mockMigration.decisions.map((decision) => (
        <Box
          key={decision.title}
          alignItems="center"
          justifyContent="between"
          columnGap="l"
          rowGap="s"
          flexWrap="wrap"
          padding="l"
          borderRadius="m"
          borderWidth={1}
          borderStyle="solid"
          borderColor="border-secondary"
        >
          <Box flexDirection="column" rowGap="xs">
            <Box alignItems="center" columnGap="s">
              <Text variant="body">{decision.title}</Text>
              <Status status={decision.kind} color="yellow" size="small" />
            </Box>
            <Text variant="caption" color="muted">
              {decision.detail}
            </Text>
          </Box>
          <Text variant="caption">Included in this prototype</Text>
        </Box>
      ))}
    </Box>
  )
}

export function ClosedState({ onReset }: { onReset: () => void }) {
  return (
    <Surface>
      <Status status="Migration closed" color="green" />
      <Text variant="heading-lg" as="h2">
        Billing ownership is known
      </Text>
      <Text color="muted">
        9 canary subscriptions bill on Polar. One remains on Stripe with a
        documented renewal-window reason.
      </Text>
      <OwnershipSummary polar={9} stripe={832} />
      <Box>
        <Button variant="secondary" onClick={onReset}>
          Run this variant again
        </Button>
      </Box>
    </Surface>
  )
}

export function PrototypeLabel({
  number,
  title,
  description,
}: {
  number: string
  title: string
  description: string
}) {
  return (
    <Box flexDirection="column" rowGap="xs">
      <Text variant="caption" color="muted">
        Variant {number}
      </Text>
      <Text variant="heading-lg" as="h2">
        {title}
      </Text>
      <Text color="muted" wrap="pretty">
        {description}
      </Text>
    </Box>
  )
}
