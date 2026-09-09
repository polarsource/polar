import { describe, expect, it } from 'vitest'
import {
  applyPrototypeAction,
  createInitialVariantStates,
  createPrototypeState,
  initialPrototypeState,
  PrototypeAction,
  PrototypeVariant,
  stageIndex,
} from './model'
import { buildTransferReceipt, getProblemSubscriptions } from './selectors'

const PROTOTYPE_VARIANTS: PrototypeVariant[] = [
  'guided',
  'tower',
  'assisted',
  'current',
]

describe('migration prototype model', () => {
  it('runs the complete mocked migration flow', () => {
    const actions: PrototypeAction[] = [
      'create',
      'assess',
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
  })

  it('ignores actions that do not belong to the current stage', () => {
    const result = applyPrototypeAction(initialPrototypeState, 'transfer')

    expect(result).toBe(initialPrototypeState)
    expect(result.receipt).toBeNull()
  })

  it('attaches receipt feedback on transfer without advancing review', () => {
    const ready = {
      ...initialPrototypeState,
      stage: 'transfer' as const,
    }

    const receipted = applyPrototypeAction(ready, 'transfer')

    expect(receipted.stage).toBe('receipt')
    expect(receipted.receiptViewed).toBe(false)
    expect(receipted.receipt).toEqual(buildTransferReceipt())
    expect(receipted.receipt?.stripeOwnedIds).toEqual(
      getProblemSubscriptions().map((record) => record.id),
    )
  })

  it('records mocked receipt feedback without advancing the flow', () => {
    const receipt = applyPrototypeAction(
      {
        ...initialPrototypeState,
        stage: 'transfer',
      },
      'transfer',
    )

    expect(applyPrototypeAction(receipt, 'review_receipt')).toEqual({
      ...receipt,
      receiptViewed: true,
    })
  })

  it('resets a completed prototype including receipt state', () => {
    const closed = applyPrototypeAction(
      applyPrototypeAction(
        {
          ...initialPrototypeState,
          stage: 'transfer',
        },
        'transfer',
      ),
      'close',
    )

    expect(closed.stage).toBe('closed')
    expect(closed.receipt).not.toBeNull()
    expect(applyPrototypeAction(closed, 'reset')).toEqual(initialPrototypeState)
  })

  it('creates independent state for guided, tower, assisted, and current', () => {
    const states = createInitialVariantStates(PROTOTYPE_VARIANTS)

    expect(Object.keys(states)).toEqual(PROTOTYPE_VARIANTS)
    expect(states.guided).toEqual(createPrototypeState())
    expect(states.tower).toEqual(initialPrototypeState)
    expect(states.assisted).toEqual(initialPrototypeState)
    expect(states.current).toEqual(createPrototypeState())
    expect(states.guided).not.toBe(states.tower)
    expect(states.tower).not.toBe(states.assisted)
    expect(states.assisted).not.toBe(states.current)

    const next = applyPrototypeAction(states.guided, 'create')
    expect(states.tower.stage).toBe('create')
    expect(states.assisted.stage).toBe('create')
    expect(states.current.stage).toBe('create')
    expect(next.stage).toBe('assessment')
  })
})
