'use client'

import { Box } from '@polar-sh/orbit/Box'
import { CurrentAssessment } from './CurrentAssessment'
import { CurrentCards } from './CurrentCards'
import { CurrentConnect } from './CurrentConnect'
import { CurrentHandoff } from './CurrentHandoff'
import { CurrentReceipt } from './CurrentReceipt'
import { CurrentStepper } from './CurrentStepper'
import { CurrentSwitch } from './CurrentSwitch'
import { PrototypeAction, PrototypeState } from './model'
import { ClosedState, PrototypeLabel } from './PrototypePrimitives'

interface Props {
  state: PrototypeState
  act: (action: PrototypeAction) => void
}

export function CurrentEvolutionVariant({ state, act }: Props) {
  if (state.stage === 'closed') {
    return <ClosedState onReset={() => act('reset')} />
  }

  return (
    <Box flexDirection="column" rowGap="xl">
      <PrototypeLabel
        number="D"
        title="Current evolution"
        description="Closest to today's UI: compact stepper, status tabs, tables, and the existing Connect → Assessment → Card movement → Switch terminology."
      />
      <CurrentStepper stage={state.stage} />
      {state.stage === 'create' ? <CurrentConnect act={act} /> : null}
      {state.stage === 'assessment' ? <CurrentAssessment act={act} /> : null}
      {state.stage === 'decisions' ? (
        <CurrentHandoff state={state} act={act} />
      ) : null}
      {state.stage === 'cards' ? (
        <CurrentCards state={state} act={act} />
      ) : null}
      {state.stage === 'transfer' ? (
        <CurrentSwitch state={state} act={act} />
      ) : null}
      {state.stage === 'receipt' ? (
        <CurrentReceipt state={state} act={act} />
      ) : null}
    </Box>
  )
}
