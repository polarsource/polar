export type PrototypeVariant = 'guided' | 'tower' | 'assisted'

export type PrototypeStage =
  | 'create'
  | 'assessment'
  | 'decisions'
  | 'cards'
  | 'transfer'
  | 'receipt'
  | 'closed'

export type PrototypeAction =
  | 'create'
  | 'assess'
  | 'resolve'
  | 'copy_cards'
  | 'transfer'
  | 'review_receipt'
  | 'close'
  | 'reset'

export interface PrototypeState {
  stage: PrototypeStage
  migrationName: string
}

export const initialPrototypeState: PrototypeState = {
  stage: 'create',
  migrationName: 'Stripe production',
}

const transitions: Record<
  Exclude<PrototypeAction, 'reset'>,
  { from: PrototypeStage; to: PrototypeStage }
> = {
  create: { from: 'create', to: 'assessment' },
  assess: { from: 'assessment', to: 'decisions' },
  resolve: { from: 'decisions', to: 'cards' },
  copy_cards: { from: 'cards', to: 'transfer' },
  transfer: { from: 'transfer', to: 'receipt' },
  review_receipt: { from: 'receipt', to: 'receipt' },
  close: { from: 'receipt', to: 'closed' },
}

export function applyPrototypeAction(
  state: PrototypeState,
  action: PrototypeAction,
): PrototypeState {
  if (action === 'reset') {
    return initialPrototypeState
  }
  const transition = transitions[action]
  if (state.stage !== transition.from) {
    return state
  }
  return { ...state, stage: transition.to }
}

export const stageIndex = (stage: PrototypeStage): number => {
  if (stage === 'closed') {
    return 6
  }
  return [
    'create',
    'assessment',
    'decisions',
    'cards',
    'transfer',
    'receipt',
  ].indexOf(stage)
}
