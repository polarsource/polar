import { buildTransferReceipt, TransferReceipt } from './selectors'
import {
  CountryResolution,
  emptyResolutionChoices,
  IdentityResolution,
  isResolutionComplete,
  ProductResolution,
  ResolutionChoices,
} from './resolutions'

export type {
  CountryResolution,
  IdentityResolution,
  ProductResolution,
  ResolutionChoices,
  ResolutionDomain,
} from './resolutions'
export {
  confirmSuggestedBillingCountry,
  emptyResolutionChoices,
  getCountryResolutionImpact,
  getCountryResolutionLabel,
  getIdentityResolutionImpact,
  getIdentityResolutionLabel,
  getProductResolutionImpact,
  getProductResolutionLabel,
  getResolutionChoiceImpact,
  getResolutionChoiceLabel,
  getResolutionCompletionCount,
  isResolutionComplete,
  RESOLUTION_DOMAINS,
  SUGGESTED_BILLING_COUNTRY,
} from './resolutions'

export type PrototypeVariant = 'guided' | 'tower' | 'assisted' | 'current'

export type PrototypeStage =
  | 'create'
  | 'assessment'
  | 'decisions'
  | 'cards'
  | 'transfer'
  | 'receipt'
  | 'closed'

export type PrototypeStageAction =
  | 'create'
  | 'assess'
  | 'resolve'
  | 'copy_cards'
  | 'transfer'
  | 'review_receipt'
  | 'close'
  | 'reset'

export type PrototypeResolutionAction =
  | { type: 'choose_product'; choice: ProductResolution }
  | { type: 'choose_country'; choice: CountryResolution }
  | { type: 'choose_identity'; choice: IdentityResolution }

export type PrototypeAction = PrototypeStageAction | PrototypeResolutionAction

export interface PrototypeState {
  stage: PrototypeStage
  receiptViewed: boolean
  receipt: TransferReceipt | null
  resolutions: ResolutionChoices
}

export const initialPrototypeState: PrototypeState = {
  stage: 'create',
  receiptViewed: false,
  receipt: null,
  resolutions: emptyResolutionChoices(),
}

export const createPrototypeState = (): PrototypeState => ({
  stage: 'create',
  receiptViewed: false,
  receipt: null,
  resolutions: emptyResolutionChoices(),
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
  Exclude<PrototypeStageAction, 'reset'>,
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

const applyResolutionAction = (
  state: PrototypeState,
  action: PrototypeResolutionAction,
): PrototypeState => {
  const resolutions = { ...state.resolutions }
  if (action.type === 'choose_product') {
    resolutions.product = action.choice
  } else if (action.type === 'choose_country') {
    resolutions.country = action.choice
  } else {
    resolutions.identity = action.choice
  }
  return { ...state, resolutions }
}

export function applyPrototypeAction(
  state: PrototypeState,
  action: PrototypeAction,
): PrototypeState {
  if (typeof action === 'object') {
    if (state.stage !== 'decisions') {
      return state
    }
    return applyResolutionAction(state, action)
  }
  if (action === 'reset') {
    return createPrototypeState()
  }
  if (action === 'review_receipt' && state.stage === 'receipt') {
    return { ...state, receiptViewed: true }
  }
  if (action === 'resolve' && !isResolutionComplete(state.resolutions)) {
    return state
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
