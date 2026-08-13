import { describe, expect, it } from 'vitest'
import {
  initialSelection,
  selectionAfterSubmit,
  SelectionState,
} from './selection'

const state = (mode: 'all' | 'none', ...ids: string[]): SelectionState => ({
  mode,
  toggled: new Set(ids),
})

const kept = (result: SelectionState) => [...result.toggled].sort()

describe('selectionAfterSubmit', () => {
  describe('opt-out mode, where everything outside `toggled` is sent', () => {
    it('keeps the excluded rows, which never left the ledger as pending', () => {
      const submitted = state('all', 'a')
      expect(kept(selectionAfterSubmit(submitted, submitted))).toEqual(['a'])
    })

    it('drops a row excluded after submit, because it was already sent', () => {
      const submitted = state('all', 'a')
      const current = state('all', 'a', 'b')
      expect(kept(selectionAfterSubmit(submitted, current))).toEqual(['a'])
    })
  })

  describe('opt-in mode, where only `toggled` is sent', () => {
    it('drops the rows it sent', () => {
      const submitted = state('none', 'a', 'b')
      expect(kept(selectionAfterSubmit(submitted, submitted))).toEqual([])
    })

    it('keeps a row picked after submit, which was not sent', () => {
      const submitted = state('none', 'a')
      const current = state('none', 'a', 'b')
      expect(kept(selectionAfterSubmit(submitted, current))).toEqual(['b'])
    })
  })

  it('clears everything when the mode flipped mid-flight', () => {
    const result = selectionAfterSubmit(state('all', 'a'), state('none', 'b'))
    expect(result.mode).toBe('none')
    expect(kept(result)).toEqual([])
  })

  it('leaves the default selection untouched', () => {
    const result = selectionAfterSubmit(initialSelection, initialSelection)
    expect(result.mode).toBe('all')
    expect(kept(result)).toEqual([])
  })
})
