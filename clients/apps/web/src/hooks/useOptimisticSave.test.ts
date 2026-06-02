import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useOptimisticSave } from './useOptimisticSave'

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
}

function defer<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

async function tick(work?: () => void) {
  await act(async () => {
    work?.()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

function setup<T>(initial: T) {
  const calls: { value: T; deferred: Deferred<boolean> }[] = []
  const save = vi.fn((value: T) => {
    const deferred = defer<boolean>()
    calls.push({ value, deferred })
    return deferred.promise
  })
  const { result } = renderHook(() => useOptimisticSave(initial, save))
  return { calls, save, result }
}

describe('useOptimisticSave', () => {
  it('starts at the initial value and saves nothing on mount', () => {
    const { calls, result } = setup({ enabled: false })

    expect(result.current.value).toEqual({ enabled: false })
    expect(calls).toHaveLength(0)
  })

  it('flips the value synchronously and fires the save before it resolves', () => {
    const { calls, result } = setup({ enabled: false })

    act(() => result.current.update({ enabled: true }))

    expect(result.current.value).toEqual({ enabled: true })
    expect(calls).toHaveLength(1)
    expect(calls[0].value).toEqual({ enabled: true })
  })

  it('persists the value and advances the confirmed baseline on success', async () => {
    const { calls, result } = setup({ enabled: false })

    act(() => result.current.update({ enabled: true }))
    await tick(() => calls[0].deferred.resolve(true))
    expect(result.current.value).toEqual({ enabled: true })

    act(() => result.current.update({ enabled: false }))
    expect(calls).toHaveLength(2)
    expect(calls[1].value).toEqual({ enabled: false })

    await tick(() => calls[1].deferred.resolve(true))
    expect(result.current.value).toEqual({ enabled: false })
  })

  it('serializes saves — an update mid-flight waits for the in-flight save', async () => {
    const { calls, result } = setup({ step: 0 })

    act(() => result.current.update({ step: 1 }))
    expect(calls).toHaveLength(1)

    act(() => result.current.update({ step: 2 }))
    expect(result.current.value).toEqual({ step: 2 })

    expect(calls).toHaveLength(1)

    await tick(() => calls[0].deferred.resolve(true))
    expect(calls).toHaveLength(2)
    expect(calls[1].value).toEqual({ step: 2 })

    await tick(() => calls[1].deferred.resolve(true))
    expect(result.current.value).toEqual({ step: 2 })
  })

  it('coalesces multiple mid-flight updates into one trailing save with the latest value', async () => {
    const { calls, result } = setup({ step: 0 })

    act(() => {
      result.current.update({ step: 1 })
      result.current.update({ step: 2 })
      result.current.update({ step: 3 })
    })

    expect(calls).toHaveLength(1)
    expect(calls[0].value).toEqual({ step: 1 })
    expect(result.current.value).toEqual({ step: 3 })

    await tick(() => calls[0].deferred.resolve(true))

    expect(calls).toHaveLength(2)
    expect(calls[1].value).toEqual({ step: 3 })

    await tick(() => calls[1].deferred.resolve(true))
    expect(result.current.value).toEqual({ step: 3 })
    expect(calls).toHaveLength(2)
  })

  it('rolls back to the last confirmed value when a save fails', async () => {
    const { calls, result } = setup({ enabled: false })

    act(() => result.current.update({ enabled: true }))
    expect(result.current.value).toEqual({ enabled: true })

    await tick(() => calls[0].deferred.resolve(false))
    expect(result.current.value).toEqual({ enabled: false })

    act(() => result.current.update({ enabled: true }))
    expect(calls).toHaveLength(2)
    await tick(() => calls[1].deferred.resolve(true))
    expect(result.current.value).toEqual({ enabled: true })
  })

  it('rolls back when the save throws (e.g. a transport error that rejects)', async () => {
    const { calls, result } = setup({ enabled: false })

    act(() => result.current.update({ enabled: true }))
    expect(result.current.value).toEqual({ enabled: true })

    await tick(() => calls[0].deferred.reject(new Error('Failed to fetch')))
    expect(result.current.value).toEqual({ enabled: false })

    act(() => result.current.update({ enabled: true }))
    expect(calls).toHaveLength(2)
    await tick(() => calls[1].deferred.resolve(true))
    expect(result.current.value).toEqual({ enabled: true })
  })

  it('reverts to the last confirmed value (not the initial) and drops pending intent on failure', async () => {
    const { calls, result } = setup({ step: 0 })

    act(() => result.current.update({ step: 1 }))
    await tick(() => calls[0].deferred.resolve(true))
    expect(result.current.value).toEqual({ step: 1 })

    act(() => result.current.update({ step: 2 }))
    act(() => result.current.update({ step: 3 }))
    expect(calls).toHaveLength(2)
    expect(result.current.value).toEqual({ step: 3 })

    await tick(() => calls[1].deferred.resolve(false))
    expect(result.current.value).toEqual({ step: 1 })
    expect(calls).toHaveLength(2)
  })

  it('passes the latest intent to the updater, compounding synchronous updates', async () => {
    const { calls, result } = setup({ count: 0 })

    act(() => {
      result.current.update((prev) => ({ count: prev.count + 1 }))
      result.current.update((prev) => ({ count: prev.count + 1 }))
    })

    expect(result.current.value).toEqual({ count: 2 })
    expect(calls[0].value).toEqual({ count: 1 })

    await tick(() => calls[0].deferred.resolve(true))
    expect(calls).toHaveLength(2)
    expect(calls[1].value).toEqual({ count: 2 })
  })

  it('always calls the latest save callback', () => {
    const initial = { enabled: false }
    const save1 = vi.fn(() => new Promise<boolean>(() => {}))
    const save2 = vi.fn(() => new Promise<boolean>(() => {}))

    const { result, rerender } = renderHook(
      ({ s }: { s: (value: typeof initial) => Promise<boolean> }) =>
        useOptimisticSave(initial, s),
      { initialProps: { s: save1 } },
    )

    rerender({ s: save2 })
    act(() => result.current.update({ enabled: true }))

    expect(save1).not.toHaveBeenCalled()
    expect(save2).toHaveBeenCalledTimes(1)
  })
})
