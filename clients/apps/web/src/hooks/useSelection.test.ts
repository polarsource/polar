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
  it('toggles a single item', () => {
    const { result } = renderSelection()

    act(() => result.current.toggle(rows[1]))
    expect(result.current.count).toBe(1)
    expect(result.current.isSelected(rows[1])).toBe(true)
    expect(result.current.pageState).toBe('some')

    act(() => result.current.toggle(rows[1]))
    expect(result.current.count).toBe(0)
    expect(result.current.pageState).toBe('none')
  })

  it('selects a range from the anchor with shiftKey', () => {
    const { result } = renderSelection()

    act(() => result.current.toggle(rows[0]))
    act(() => result.current.toggle(rows[2], { shiftKey: true }))

    expect(result.current.selected.map(getId)).toEqual(['a', 'b', 'c'])
  })

  it('deselects a range when shift-clicking a selected item', () => {
    const { result } = renderSelection()

    act(() => result.current.setPageSelected(true))
    act(() => result.current.toggle(rows[0]))
    // 'a' is now deselected and the anchor; shift-clicking the still-selected
    // 'c' clears the range rather than re-selecting it.
    act(() => result.current.toggle(rows[2], { shiftKey: true }))

    expect(result.current.selected.map(getId)).toEqual(['d'])
  })

  it('reports page state for the visible page only', () => {
    const { result, rerender } = renderSelection()

    act(() => result.current.setPageSelected(true))
    expect(result.current.pageState).toBe('all')
    expect(result.current.count).toBe(4)

    const nextPage = [row('e'), row('f')]
    rerender({ items: nextPage, resetKey: undefined })

    expect(result.current.pageState).toBe('none')
    expect(result.current.count).toBe(4)
  })

  it('re-projects selected items through the current page', () => {
    const { result, rerender } = renderSelection()

    act(() => result.current.toggle(rows[0]))
    expect(result.current.selected[0].status).toBe('pending')

    rerender({
      items: [row('a', 'archived'), ...rows.slice(1)],
      resetKey: undefined,
    })

    expect(result.current.selected[0].status).toBe('archived')
  })

  it('keeps snapshots for items no longer on the page', () => {
    const { result, rerender } = renderSelection()

    act(() => result.current.toggle(rows[0]))
    rerender({ items: [row('z')], resetKey: undefined })

    expect(result.current.selected.map(getId)).toEqual(['a'])
  })

  it('clears the selection when resetKey changes', () => {
    const { result, rerender } = renderSelection(rows, 'status=pending')

    act(() => result.current.toggle(rows[0]))
    expect(result.current.count).toBe(1)

    rerender({ items: rows, resetKey: 'status=all' })
    expect(result.current.count).toBe(0)
  })

  it('keeps toggle and setPageSelected referentially stable across refetches', () => {
    const { result, rerender } = renderSelection()

    const { toggle, setPageSelected, clear } = result.current
    rerender({ items: rows.map((item) => ({ ...item })), resetKey: undefined })

    expect(result.current.toggle).toBe(toggle)
    expect(result.current.setPageSelected).toBe(setPageSelected)
    expect(result.current.clear).toBe(clear)
  })

  it('acts on the latest items after a refetch', () => {
    const { result, rerender } = renderSelection()

    const nextPage = [row('e'), row('f')]
    rerender({ items: nextPage, resetKey: undefined })
    act(() => result.current.setPageSelected(true))

    expect(result.current.selected.map(getId)).toEqual(['e', 'f'])
  })
})
