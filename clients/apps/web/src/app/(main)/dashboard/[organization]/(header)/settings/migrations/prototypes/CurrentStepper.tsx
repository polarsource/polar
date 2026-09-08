import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { PrototypeStage } from './model'

const VISIBLE_STEPS = [
  'Connect',
  'Assessment',
  'Card movement',
  'Switch',
] as const

export function visibleStepIndex(stage: PrototypeStage): number {
  if (stage === 'create') {
    return 0
  }
  if (stage === 'assessment' || stage === 'decisions') {
    return 1
  }
  if (stage === 'cards') {
    return 2
  }
  if (stage === 'transfer' || stage === 'receipt') {
    return 3
  }
  return 4
}

export function CurrentStepper({ stage }: { stage: PrototypeStage }) {
  const current = visibleStepIndex(stage)
  return (
    <Box
      as="ol"
      alignItems="stretch"
      columnGap="s"
      aria-label="Migration steps"
    >
      {VISIBLE_STEPS.map((label, index) => {
        const reached = index <= current
        const isCurrent = index === current
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
            aria-current={isCurrent ? 'step' : undefined}
          >
            <Text
              variant="caption"
              color={isCurrent ? 'accent' : reached ? 'default' : 'muted'}
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
