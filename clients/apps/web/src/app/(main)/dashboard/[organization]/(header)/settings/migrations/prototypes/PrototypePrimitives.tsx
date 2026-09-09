import { Button, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ReactNode } from 'react'
import { flowSteps } from './mockData'
import { PrototypeStage, stageIndex } from './model'
import { getOwnershipForTransfer } from './selectors'

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
    <Box
      as="ol"
      aria-label="Migration prototype steps"
      columnGap="s"
      alignItems="stretch"
      maxWidth="100%"
      overflowX="auto"
    >
      {flowSteps.map((label, index) => {
        const reached = index <= activeIndex
        const current = index === activeIndex
        return (
          <Box
            as="li"
            key={label}
            flex={1}
            minWidth={{ base: 88, md: 0 }}
            flexDirection="column"
            rowGap="s"
            paddingTop="s"
            borderTopWidth={2}
            borderStyle="solid"
            borderColor={reached ? 'border-primary' : 'border-secondary'}
            aria-current={current ? 'step' : undefined}
          >
            <Text variant="caption" color={current ? 'default' : 'muted'}>
              {index + 1}. {label}
            </Text>
          </Box>
        )
      })}
    </Box>
  )
}

export function OwnershipSummary({
  transferred = false,
  polar,
  stripe,
  unknown,
}: {
  transferred?: boolean
  polar?: number
  stripe?: number
  unknown?: number
}) {
  const ownership = getOwnershipForTransfer(transferred)
  return (
    <Box
      gap="l"
      flexWrap="wrap"
      padding="l"
      borderRadius="m"
      backgroundColor="background-secondary"
    >
      <Metric label="Billing on Polar" value={polar ?? ownership.polarOwned} />
      <Metric
        label="Billing on Stripe"
        value={stripe ?? ownership.stripeOwned}
      />
      <Metric label="Unknown owner" value={unknown ?? ownership.unknownOwned} />
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

export function ClosedState({ onReset }: { onReset: () => void }) {
  return (
    <Surface>
      <Status status="Migration closed" color="green" />
      <Text variant="heading-l" as="h2">
        Billing ownership is known
      </Text>
      <Text color="muted">
        Every subscription has a documented billing owner and next action.
      </Text>
      <OwnershipSummary transferred />
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
      <Text variant="heading-l" as="h2">
        {title}
      </Text>
      <Text color="muted" wrap="pretty">
        {description}
      </Text>
    </Box>
  )
}
