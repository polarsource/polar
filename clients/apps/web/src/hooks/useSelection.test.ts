import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useSelection } from './useSelection'

interface Row {
  id: string
  status: string
}

const row = (id: string, status = 'pending'): Row => ({ id, status })
const rows = [row('a'), row('b'), row('c'), row('d')]
const getId = (item: Row) => item.id

const renderSelection = (items: Row[] = rows, resetKey?: string) =>
  renderHook(
    ({ items, resetKey }: { items: Row[]; resetKey?: string }) =>
      useSelection({ items, getId, resetKey }),
    { initialProps: { items, resetKey } },
  )

describe('useSelection', () => {
  it('applies the clicked item state across a shift-click range', () => {
    const { result } = renderSelection()

    act(() => result.current.setPageSelected(true))
    act(() => result.current.toggle(rows[0]))
    act(() => result.current.toggle(rows[2], { shiftKey: true }))

    expect(result.current.selected.map(getId)).toEqual(['d'])
  })

  it('keeps off-page selections while pageState reflects the visible page', () => {
    const { result, rerender } = renderSelection()

    act(() => result.current.setPageSelected(true))
    rerender({ items: [row('e'), row('f')], resetKey: undefined })

    expect(result.current.pageState).toBe('none')
    expect(result.current.count).toBe(4)
  })

  it('clears when resetKey changes', () => {
    const { result, rerender } = renderSelection(rows, 'status=pending')

    act(() => result.current.toggle(rows[0]))
    rerender({ items: rows, resetKey: 'status=all' })

    expect(result.current.count).toBe(0)
  })

  it('acts on the latest items after a refetch', () => {
    const { result, rerender } = renderSelection()

    rerender({ items: [row('e'), row('f')], resetKey: undefined })
    act(() => result.current.setPageSelected(true))

    expect(result.current.selected.map(getId)).toEqual(['e', 'f'])
  })
})
