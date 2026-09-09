import { describe, expect, it } from 'vitest'
import {
  applyPrototypeAction,
  confirmSuggestedBillingCountry,
  createInitialVariantStates,
  createPrototypeState,
  getResolutionCompletionCount,
  initialPrototypeState,
  isResolutionComplete,
  PrototypeAction,
  PrototypeState,
  PrototypeVariant,
  stageIndex,
  SUGGESTED_BILLING_COUNTRY,
} from './model'
import { buildTransferReceipt, getProblemSubscriptions } from './selectors'

const VARIANTS: PrototypeVariant[] = ['guided', 'tower', 'assisted', 'current']

const completeResolutions = (state: PrototypeState): PrototypeState =>
  (
    [
      { type: 'choose_product', choice: 'map_existing_pro' },
      { type: 'choose_country', choice: confirmSuggestedBillingCountry() },
      { type: 'choose_identity', choice: 'link_existing_customer' },
    ] as const
  ).reduce(applyPrototypeAction, state)

const toDecisions = (
  state: PrototypeState = createPrototypeState(),
): PrototypeState =>
  (['create', 'assess'] as const).reduce(applyPrototypeAction, state)

describe('migration prototype model', () => {
  it('runs the complete mocked migration flow after resolutions', () => {
    const actions: PrototypeAction[] = [
      'create',
      'assess',
      { type: 'choose_product', choice: 'map_existing_pro' },
      { type: 'choose_country', choice: confirmSuggestedBillingCountry() },
      { type: 'choose_identity', choice: 'link_existing_customer' },
      'resolve',
      'copy_cards',
      'transfer',
      'close',
    ]
    const result = actions.reduce(applyPrototypeAction, initialPrototypeState)
    expect(result.stage).toBe('closed')
    expect(stageIndex(result.stage)).toBe(6)
    expect(result.receipt?.moved).toBe(20)
    expect(result.receipt?.stripeOwned).toBe(16)
    expect(result.receipt?.unknownOwned).toBe(0)
    expect(isResolutionComplete(result.resolutions)).toBe(true)
    expect(result.returnStage).toBeNull()
  })

  it('ignores actions that do not belong to the current stage', () => {
    const result = applyPrototypeAction(initialPrototypeState, 'transfer')
    expect(result).toBe(initialPrototypeState)
    expect(result.receipt).toBeNull()
  })

  it('ignores resolution choices outside the decisions stage', () => {
    const result = applyPrototypeAction(initialPrototypeState, {
      type: 'choose_product',
      choice: 'map_existing_pro',
    })
    expect(result).toBe(initialPrototypeState)
    expect(result.resolutions.product).toBeNull()
  })

  it('gates resolve until all three domains have explicit choices', () => {
    const decisions = toDecisions()
    expect(applyPrototypeAction(decisions, 'resolve')).toBe(decisions)

    const withProduct = applyPrototypeAction(decisions, {
      type: 'choose_product',
      choice: 'leave_on_stripe',
    })
    expect(applyPrototypeAction(withProduct, 'resolve')).toEqual(withProduct)

    const withCountry = applyPrototypeAction(withProduct, {
      type: 'choose_country',
      choice: { disposition: 'leave_on_stripe' },
    })
    expect(applyPrototypeAction(withCountry, 'resolve')).toEqual(withCountry)

    const complete = applyPrototypeAction(withCountry, {
      type: 'choose_identity',
      choice: 'leave_on_stripe',
    })
    expect(getResolutionCompletionCount(complete.resolutions)).toBe(3)
    expect(applyPrototypeAction(complete, 'resolve').stage).toBe('cards')
  })

  it('persists product choice family and alternate selections', () => {
    let state = toDecisions()
    for (const choice of [
      'map_existing_pro',
      'create_separate_product',
      'leave_on_stripe',
    ] as const) {
      state = applyPrototypeAction(state, { type: 'choose_product', choice })
      expect(state.resolutions.product).toBe(choice)
    }
  })

  it('persists country confirm, alternate country, and leave dispositions', () => {
    let state = toDecisions()
    state = applyPrototypeAction(state, {
      type: 'choose_country',
      choice: confirmSuggestedBillingCountry(),
    })
    expect(state.resolutions.country).toEqual({
      disposition: 'set_country',
      country: SUGGESTED_BILLING_COUNTRY,
    })

    state = applyPrototypeAction(state, {
      type: 'choose_country',
      choice: { disposition: 'set_country', country: 'Germany' },
    })
    expect(state.resolutions.country).toEqual({
      disposition: 'set_country',
      country: 'Germany',
    })

    state = applyPrototypeAction(state, {
      type: 'choose_country',
      choice: { disposition: 'leave_on_stripe' },
    })
    expect(state.resolutions.country).toEqual({
      disposition: 'leave_on_stripe',
    })
  })

  it('persists identity choice family and alternate selections', () => {
    let state = toDecisions()
    for (const choice of [
      'link_existing_customer',
      'create_separate_customer',
      'leave_on_stripe',
    ] as const) {
      state = applyPrototypeAction(state, { type: 'choose_identity', choice })
      expect(state.resolutions.identity).toBe(choice)
    }
  })

  it('keeps resolution choices independent across all four variants', () => {
    const states = createInitialVariantStates(VARIANTS)
    const guided = applyPrototypeAction(toDecisions(states.guided), {
      type: 'choose_product',
      choice: 'map_existing_pro',
    })
    const tower = applyPrototypeAction(toDecisions(states.tower), {
      type: 'choose_product',
      choice: 'create_separate_product',
    })
    const assisted = applyPrototypeAction(toDecisions(states.assisted), {
      type: 'choose_identity',
      choice: 'leave_on_stripe',
    })
    const current = applyPrototypeAction(toDecisions(states.current), {
      type: 'choose_country',
      choice: { disposition: 'set_country', country: 'France' },
    })

    expect(guided.resolutions.product).toBe('map_existing_pro')
    expect(tower.resolutions.product).toBe('create_separate_product')
    expect(assisted.resolutions.identity).toBe('leave_on_stripe')
    expect(current.resolutions.country).toEqual({
      disposition: 'set_country',
      country: 'France',
    })
    expect(states.guided.resolutions.product).toBeNull()
    expect(tower.resolutions.identity).toBeNull()
    expect(current.resolutions.product).toBeNull()
  })

  it('preserves receipt invariants on transfer and review', () => {
    const receipted = applyPrototypeAction(
      { ...createPrototypeState(), stage: 'transfer' },
      'transfer',
    )
    expect(receipted.stage).toBe('receipt')
    expect(receipted.receiptViewed).toBe(false)
    expect(receipted.receipt).toEqual(buildTransferReceipt())
    expect(receipted.receipt?.moved).toBe(20)
    expect(receipted.receipt?.stripeOwnedIds).toEqual(
      getProblemSubscriptions().map((record) => record.id),
    )
    expect(applyPrototypeAction(receipted, 'review_receipt')).toEqual({
      ...receipted,
      receiptViewed: true,
    })
  })

  it('resets completed prototype including receipt and resolutions', () => {
    let state = completeResolutions(toDecisions())
    for (const action of [
      'resolve',
      'copy_cards',
      'transfer',
      'close',
    ] as const) {
      state = applyPrototypeAction(state, action)
    }
    expect(state.stage).toBe('closed')
    expect(state.receipt).not.toBeNull()
    expect(isResolutionComplete(state.resolutions)).toBe(true)
    expect(applyPrototypeAction(state, 'reset')).toEqual(initialPrototypeState)
  })

  it('creates independent state for guided, tower, assisted, and current', () => {
    const states = createInitialVariantStates(VARIANTS)
    expect(Object.keys(states)).toEqual(VARIANTS)
    expect(states.guided).toEqual(createPrototypeState())
    expect(states.tower).toEqual(initialPrototypeState)
    expect(states.guided).not.toBe(states.tower)
    expect(applyPrototypeAction(states.guided, 'create').stage).toBe(
      'assessment',
    )
    expect(states.current.stage).toBe('create')
  })
})
