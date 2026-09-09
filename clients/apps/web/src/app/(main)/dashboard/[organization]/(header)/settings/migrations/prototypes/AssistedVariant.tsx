'use client'

import { Grid, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { AssistedTask } from './AssistedTask'
import { PrototypeAction, PrototypeState, stageIndex } from './model'
import { ClosedState, PrototypeLabel, Surface } from './PrototypePrimitives'

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
