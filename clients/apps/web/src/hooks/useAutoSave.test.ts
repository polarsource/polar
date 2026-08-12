import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useForm } from 'react-hook-form'
import { useAutoSave } from './useAutoSave'

type FormValues = {
  primary: string
  secondary: string
}

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
}

function defer<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

async function tick(work?: () => void) {
  await act(async () => {
    work?.()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

function setup(initial: FormValues) {
  const calls: {
    values: FormValues
    deferred: Deferred<FormValues | undefined>
  }[] = []
  const onSave = vi.fn((values: FormValues) => {
    const deferred = defer<FormValues | undefined>()
    calls.push({ values: { ...values }, deferred })
    return deferred.promise
  })
  const hook = renderHook(() => {
    const form = useForm<FormValues>({ defaultValues: initial })
    useAutoSave({ form, onSave, delay: 200 })
    return form
  })

  return { ...hook, calls, onSave }
}

describe('useAutoSave', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('debounces changes and resets to the saved values without another save', async () => {
    const { calls, result } = setup({ primary: 'initial', secondary: '' })

    act(() => result.current.setValue('primary', 'draft'))
    await act(async () => vi.advanceTimersByTimeAsync(200))

    expect(calls).toHaveLength(1)
    expect(calls[0].values).toEqual({ primary: 'draft', secondary: '' })

    await tick(() =>
      calls[0].deferred.resolve({ primary: 'canonical', secondary: '' }),
    )

    expect(result.current.getValues()).toEqual({
      primary: 'canonical',
      secondary: '',
    })

    await act(async () => vi.advanceTimersByTimeAsync(200))
    expect(calls).toHaveLength(1)
  })

  it('does not re-save after a successful reset and consumer rerenders', async () => {
    const onSave = vi.fn(async (values: FormValues) => ({
      ...values,
      primary: values.primary.trim(),
    }))
    const { result, rerender } = renderHook(
      ({ revision }: { revision: number }) => {
        const form = useForm<FormValues>({
          defaultValues: { primary: 'initial', secondary: '' },
        })
        useAutoSave({
          form,
          onSave: async (values) => {
            void revision
            return onSave(values)
          },
          delay: 200,
        })
        return form
      },
      { initialProps: { revision: 0 } },
    )

    act(() => result.current.setValue('primary', ' saved '))
    await act(async () => vi.advanceTimersByTimeAsync(200))
    await tick()

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(result.current.getValues().primary).toBe('saved')

    rerender({ revision: 1 })
    rerender({ revision: 2 })
    await act(async () => vi.advanceTimersByTimeAsync(10_000))

    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('keeps an edit made during a save and flushes it after the debounce expires', async () => {
    const { calls, result } = setup({ primary: 'initial', secondary: '' })

    act(() => result.current.setValue('primary', 'first'))
    await act(async () => vi.advanceTimersByTimeAsync(200))

    act(() => result.current.setValue('secondary', 'second'))
    await act(async () => vi.advanceTimersByTimeAsync(200))

    expect(calls).toHaveLength(1)

    await tick(() =>
      calls[0].deferred.resolve({ primary: 'first', secondary: '' }),
    )

    expect(result.current.getValues()).toEqual({
      primary: 'first',
      secondary: 'second',
    })
    expect(calls).toHaveLength(2)
    expect(calls[1].values).toEqual({
      primary: 'first',
      secondary: 'second',
    })
  })

  it('waits for the remaining debounce when a save finishes first', async () => {
    const { calls, result } = setup({ primary: 'initial', secondary: '' })

    act(() => result.current.setValue('primary', 'first'))
    await act(async () => vi.advanceTimersByTimeAsync(200))

    act(() => result.current.setValue('secondary', 'second'))
    await tick(() =>
      calls[0].deferred.resolve({ primary: 'first', secondary: '' }),
    )

    expect(result.current.getValues().secondary).toBe('second')
    expect(calls).toHaveLength(1)

    await act(async () => vi.advanceTimersByTimeAsync(199))
    expect(calls).toHaveLength(1)

    await act(async () => vi.advanceTimersByTimeAsync(1))
    expect(calls).toHaveLength(2)
    expect(calls[1].values.secondary).toBe('second')
  })

  it('coalesces multiple edits during a save into one trailing save', async () => {
    const { calls, result } = setup({ primary: 'initial', secondary: '' })

    act(() => result.current.setValue('primary', 'first'))
    await act(async () => vi.advanceTimersByTimeAsync(200))

    act(() => {
      result.current.setValue('secondary', 'one')
      result.current.setValue('secondary', 'two')
      result.current.setValue('secondary', 'latest')
    })
    await act(async () => vi.advanceTimersByTimeAsync(200))
    await tick(() =>
      calls[0].deferred.resolve({ primary: 'first', secondary: '' }),
    )

    expect(calls).toHaveLength(2)
    expect(calls[1].values.secondary).toBe('latest')
  })

  it('cancels a pending save on unmount', async () => {
    const { calls, result, unmount } = setup({
      primary: 'initial',
      secondary: '',
    })

    act(() => result.current.setValue('primary', 'draft'))
    unmount()
    await act(async () => vi.advanceTimersByTimeAsync(200))

    expect(calls).toHaveLength(0)
  })
})
