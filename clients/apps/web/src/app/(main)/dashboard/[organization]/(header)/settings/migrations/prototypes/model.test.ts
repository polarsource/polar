import { describe, expect, it } from 'vitest'
import {
  applyPrototypeAction,
  initialPrototypeState,
  PrototypeAction,
  stageIndex,
} from './model'

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
  })

  it('ignores actions that do not belong to the current stage', () => {
    const result = applyPrototypeAction(initialPrototypeState, 'transfer')

    expect(result).toBe(initialPrototypeState)
  })

  it('records mocked receipt feedback without advancing the flow', () => {
    const receipt = {
      ...initialPrototypeState,
      stage: 'receipt' as const,
    }

    expect(applyPrototypeAction(receipt, 'review_receipt')).toEqual({
      ...receipt,
      receiptViewed: true,
    })
  })

  it('resets a completed prototype', () => {
    const closed = {
      ...initialPrototypeState,
      stage: 'closed' as const,
    }

    expect(applyPrototypeAction(closed, 'reset')).toEqual(initialPrototypeState)
  })
})
