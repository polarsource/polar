import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDebouncedCallback } from './utils'

describe('useDebouncedCallback', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls the callback after the delay', () => {
    const callback = vi.fn()
    const { result } = renderHook(() => useDebouncedCallback(callback, 300))

    act(() => {
      result.current('query')
    })

    expect(callback).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(callback).toHaveBeenCalledOnce()
    expect(callback).toHaveBeenCalledWith('query')
  })

  it('debounces multiple calls', () => {
    const callback = vi.fn()
    const { result } = renderHook(() => useDebouncedCallback(callback, 300))

    act(() => {
      result.current('first')
      result.current('second')
    })

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(callback).toHaveBeenCalledOnce()
    expect(callback).toHaveBeenCalledWith('second')
  })

  it('uses the latest callback after a rerender', () => {
    const onSearch = vi.fn()
    const { result, rerender } = renderHook(
      ({ sorting }) =>
        useDebouncedCallback((query: string) => onSearch(query, sorting), 300),
      { initialProps: { sorting: 'name' } },
    )

    act(() => {
      result.current('query')
    })

    rerender({ sorting: 'created_at' })

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(onSearch).toHaveBeenCalledOnce()
    expect(onSearch).toHaveBeenCalledWith('query', 'created_at')
  })

  it('clears the pending callback on unmount', () => {
    const callback = vi.fn()
    const { result, unmount } = renderHook(() =>
      useDebouncedCallback(callback, 300),
    )

    act(() => {
      result.current()
    })

    unmount()

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(callback).not.toHaveBeenCalled()
  })
})
