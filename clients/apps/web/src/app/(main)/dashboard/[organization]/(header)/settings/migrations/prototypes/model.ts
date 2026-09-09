import { buildTransferReceipt, TransferReceipt } from './selectors'

export type PrototypeVariant = 'guided' | 'tower' | 'assisted' | 'current'

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
  receiptViewed: boolean
  receipt: TransferReceipt | null
}

export const initialPrototypeState: PrototypeState = {
  stage: 'create',
  receiptViewed: false,
  receipt: null,
}

export const createPrototypeState = (): PrototypeState => ({
  ...initialPrototypeState,
  receipt: null,
})

export const createInitialVariantStates = <
  Variant extends string = PrototypeVariant,
>(
  variants: readonly Variant[],
): Record<Variant, PrototypeState> =>
  Object.fromEntries(
    variants.map((variant) => [variant, createPrototypeState()]),
  ) as Record<Variant, PrototypeState>

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
    return createPrototypeState()
  }
  if (action === 'review_receipt' && state.stage === 'receipt') {
    return { ...state, receiptViewed: true }
  }
  const transition = transitions[action]
  if (state.stage !== transition.from) {
    return state
  }
  if (action === 'transfer') {
    return {
      ...state,
      stage: transition.to,
      receipt: buildTransferReceipt(),
      receiptViewed: false,
    }
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
