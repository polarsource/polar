'use client'

import { Box } from '@polar-sh/orbit/Box'
import { Text } from '@polar-sh/orbit'
import {
  getResolutionCompletionCount,
  PrototypeAction,
  PrototypeState,
  RESOLUTION_DOMAINS,
} from './model'
import {
  ClosedState,
  OwnershipSummary,
  PrototypeLabel,
} from './PrototypePrimitives'
import { getCleanSubscriptions, getProblemSubscriptions } from './selectors'
import { TowerWorkspace } from './TowerWorkspace'

interface Props {
  state: PrototypeState
  act: (action: PrototypeAction) => void
}

function cohortCounts(state: PrototypeState) {
  const stage = state.stage
  if (stage === 'create') {
    return { ready: 0, decisions: 0, blocked: 0, holds: 0, moved: 0 }
  }
  const problems = getProblemSubscriptions()
  const ready = getCleanSubscriptions().length
  const unresolved =
    RESOLUTION_DOMAINS.length - getResolutionCompletionCount(state.resolutions)
  return {
    ready: stage === 'receipt' ? 0 : ready,
    decisions: stage === 'decisions' ? unresolved : 0,
    blocked: problems.filter((r) => r.status === 'blocked').length,
    holds: problems.filter((r) => r.status === 'cutover_hold').length,
    moved: stage === 'receipt' ? ready : 0,
  }
}

export function ControlTowerVariant({ state, act }: Props) {
  const transferred = state.stage === 'receipt'
  const cohorts = cohortCounts(state)

  if (state.stage === 'closed') {
    return <ClosedState onReset={() => act('reset')} />
  }

  return (
    <Box flexDirection="column" rowGap="xl">
      <PrototypeLabel
        number="B"
        title="Migration control tower"
        description="A persistent operations view. Cohorts, exceptions, and billing ownership stay visible throughout."
      />
      <OwnershipSummary transferred={transferred} />
      <Box
        flexDirection={{ base: 'column', lg: 'row' }}
        gap="l"
        alignItems="stretch"
      >
        <Box
          flexDirection="column"
          rowGap="s"
          flex={{ base: '1 1 auto', lg: '0 0 280px' }}
          aria-label="Cohort counts"
        >
          <Text variant="label">Cohort summary</Text>
          <Text variant="caption" color="muted">
            Live counts; choose work from the detail pane.
          </Text>
          <TowerQueue
            label="Ready"
            value={cohorts.ready}
            active={state.stage === 'transfer'}
          />
          <TowerQueue
            label="Decisions"
            value={cohorts.decisions}
            active={state.stage === 'decisions'}
          />
          <TowerQueue
            label="Blocked"
            value={cohorts.blocked}
            active={state.stage === 'decisions'}
          />
          <TowerQueue
            label="Holds"
            value={cohorts.holds}
            active={state.stage === 'cards' || state.stage === 'receipt'}
          />
          <TowerQueue
            label="Moved to Polar"
            value={cohorts.moved}
            active={state.stage === 'receipt'}
          />
        </Box>
        <Box flex={1} minWidth={0}>
          <TowerWorkspace state={state} act={act} />
        </Box>
      </Box>
    </Box>
  )
}

function TowerQueue({
  label,
  value,
  active,
}: {
  label: string
  value: number
  active: boolean
}) {
  return (
    <Box
      alignItems="center"
      justifyContent="between"
      padding="l"
      borderRadius="m"
      borderWidth={1}
      borderStyle="solid"
      borderColor={active ? 'border-warning' : 'border-secondary'}
      backgroundColor={active ? 'background-warning' : 'background-card'}
    >
      <Text variant="caption">{label}</Text>
      <Text variant="body" tabularNums>
        {value}
      </Text>
    </Box>
  )
}
