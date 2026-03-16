import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDebouncedCallback } from './debounce'

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
      result.current('hello')
    })

    expect(callback).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(callback).toHaveBeenCalledWith('hello')
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('debounces multiple rapid calls', () => {
    const callback = vi.fn()
    const { result } = renderHook(() => useDebouncedCallback(callback, 200))

    act(() => {
      result.current('a')
      result.current('b')
      result.current('c')
    })

    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith('c')
  })

  it('resets the timer on each call', () => {
    const callback = vi.fn()
    const { result } = renderHook(() => useDebouncedCallback(callback, 300))

    act(() => {
      result.current('first')
    })

    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(callback).not.toHaveBeenCalled()

    act(() => {
      result.current('second')
    })

    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(callback).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(callback).toHaveBeenCalledWith('second')
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('passes multiple arguments to the callback', () => {
    const callback = vi.fn()
    const { result } = renderHook(() => useDebouncedCallback(callback, 100))

    act(() => {
      result.current('arg1', 42)
    })

    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(callback).toHaveBeenCalledWith('arg1', 42)
  })

  it('does not call the callback if delay has not elapsed', () => {
    const callback = vi.fn()
    const { result } = renderHook(() => useDebouncedCallback(callback, 500))

    act(() => {
      result.current()
    })

    act(() => {
      vi.advanceTimersByTime(499)
    })

    expect(callback).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1)
    })

    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('fires separately for calls spaced beyond the delay', () => {
    const callback = vi.fn()
    const { result } = renderHook(() => useDebouncedCallback(callback, 100))

    act(() => {
      result.current('first')
    })

    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith('first')

    act(() => {
      result.current('second')
    })

    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(callback).toHaveBeenCalledTimes(2)
    expect(callback).toHaveBeenLastCalledWith('second')
  })
})
