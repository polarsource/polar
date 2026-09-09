import { describe, expect, it } from 'vitest'
import {
  applyPrototypeAction,
  applyVariantPrototypeAction,
  confirmSuggestedBillingCountry,
  createPrototypeState,
  emptyResolutionChoices,
  initialPrototypeState,
  isResolutionComplete,
  PrototypeState,
  recommendedResolutionChoices,
} from './model'
import { buildTransferReceipt } from './selectors'

const completeResolutions = (state: PrototypeState): PrototypeState =>
  (
    [
      { type: 'choose_product', choice: 'map_existing_pro' },
      { type: 'choose_country', choice: confirmSuggestedBillingCountry() },
      { type: 'choose_identity', choice: 'link_existing_customer' },
    ] as const
  ).reduce(applyPrototypeAction, state)

const toAssessment = (
  state: PrototypeState = createPrototypeState(),
): PrototypeState => applyPrototypeAction(state, 'create')

const toDecisions = (
  state: PrototypeState = createPrototypeState(),
): PrototypeState => applyPrototypeAction(toAssessment(state), 'assess')

const advanceTo = (
  target: 'cards' | 'transfer' | 'receipt',
): PrototypeState => {
  let state = completeResolutions(toDecisions())
  state = applyPrototypeAction(state, 'resolve')
  if (target === 'cards') {
    return state
  }
  state = applyPrototypeAction(state, 'copy_cards')
  return target === 'transfer' ? state : applyPrototypeAction(state, 'transfer')
}

describe('migration prototype recommendations and editing', () => {
  it('seeds recommended Polar proposals when Assisted assesses', () => {
    const assessed = applyVariantPrototypeAction(
      'assisted',
      toAssessment(),
      'assess',
    )
    expect(assessed.stage).toBe('decisions')
    expect(assessed.resolutions).toEqual(recommendedResolutionChoices())
  })

  it('does not seed recommendations for other variants', () => {
    for (const variant of ['guided', 'tower', 'current'] as const) {
      const assessed = applyVariantPrototypeAction(
        variant,
        toAssessment(),
        'assess',
      )
      expect(assessed.resolutions).toEqual(emptyResolutionChoices())
    }
  })

  it('allows changing seeded Assisted recommendations', () => {
    let state = applyVariantPrototypeAction(
      'assisted',
      toAssessment(),
      'assess',
    )
    state = applyPrototypeAction(state, {
      type: 'choose_product',
      choice: 'leave_on_stripe',
    })
    state = applyPrototypeAction(state, {
      type: 'choose_country',
      choice: { disposition: 'leave_on_stripe' },
    })
    state = applyPrototypeAction(state, {
      type: 'choose_identity',
      choice: 'create_separate_customer',
    })
    expect(state.resolutions).toEqual({
      product: 'leave_on_stripe',
      country: { disposition: 'leave_on_stripe' },
      identity: 'create_separate_customer',
    })
  })

  it('returns to the stage that opened resolution editing', () => {
    for (const target of ['cards', 'transfer', 'receipt'] as const) {
      const started = advanceTo(target)
      const edited = applyPrototypeAction(started, 'edit_resolutions')
      expect(edited.stage).toBe('decisions')
      expect(edited.returnStage).toBe(target)

      const returned = applyPrototypeAction(edited, 'resolve')
      expect(returned.stage).toBe(target)
      expect(returned.returnStage).toBeNull()
    }
  })

  it('keeps receipt state intact through editing', () => {
    const reviewed = applyPrototypeAction(
      advanceTo('receipt'),
      'review_receipt',
    )
    const edited = applyPrototypeAction(reviewed, 'edit_resolutions')
    const returned = applyPrototypeAction(edited, 'resolve')

    expect(returned.stage).toBe('receipt')
    expect(returned.receipt).toEqual(buildTransferReceipt())
    expect(returned.receiptViewed).toBe(true)
  })

  it('keeps incomplete edited choices gated', () => {
    const edited = applyPrototypeAction(advanceTo('cards'), 'edit_resolutions')
    const incomplete = {
      ...edited,
      resolutions: { ...edited.resolutions, identity: null },
    }
    expect(isResolutionComplete(incomplete.resolutions)).toBe(false)
    expect(applyPrototypeAction(incomplete, 'resolve')).toEqual(incomplete)
  })

  it('clears the return stage on reset', () => {
    const edited = applyPrototypeAction(advanceTo('cards'), 'edit_resolutions')
    expect(applyPrototypeAction(edited, 'reset')).toEqual(initialPrototypeState)
  })

  it('ignores edit outside cards, transfer, and receipt', () => {
    expect(applyPrototypeAction(toDecisions(), 'edit_resolutions').stage).toBe(
      'decisions',
    )
    expect(applyPrototypeAction(toAssessment(), 'edit_resolutions')).toEqual(
      toAssessment(),
    )
  })

  it('keeps the base reducer variant-agnostic on assess', () => {
    const assessed = applyPrototypeAction(toAssessment(), 'assess')
    expect(assessed.resolutions).toEqual(emptyResolutionChoices())
  })
})
